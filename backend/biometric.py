"""
biometric.py
-------------
Live eSSL biometric attendance for the STC portal. Admin-only. Pulls from ALL
configured devices (e.g. Inside + Door), stores every punch tagged by device,
and surfaces them on the portal.

Endpoints (under /api):
  GET  /api/biometric/live?date=YYYY-MM-DD     pull all devices now, store, return every punch
  GET  /api/biometric/summary?date=YYYY-MM-DD  per-employee first-in / last-out (across devices)
  GET  /api/biometric/punches?date=YYYY-MM-DD  read stored punches
  POST /api/biometric/sync                      pull a range -> Attendance daily records
"""
import os
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

from database import attendance_db, stc_db
from models import get_current_admin_user, get_current_user
from essl_service import get_all_punches, IST, ESSLConfigError, ESSLRequestError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/biometric", tags=["Biometric / eSSL"])

PUNCHES = attendance_db["biometric_punches"]
ATTENDANCE = attendance_db["Attendance"]
SHIFT_START = (9, 30)

# device  -> backend calls the eSSL devices directly (use on the office LAN / laptop)
# store   -> backend only READS punches from Mongo, written by the office sync agent
#            (use when deployed on AWS, which cannot reach the office LAN)
ESSL_SOURCE = os.environ.get("ESSL_SOURCE", "device").lower()

# Direction is pinned to the SERIAL number (robust), not the display name.
# Set these in .env:  ESSL_IN_SERIALS=JNP2244500022   ESSL_OUT_SERIALS=CEXJ232860602
ESSL_IN_SERIALS = {s.strip() for s in os.environ.get("ESSL_IN_SERIALS", "").split(",") if s.strip()}
ESSL_OUT_SERIALS = {s.strip() for s in os.environ.get("ESSL_OUT_SERIALS", "").split(",") if s.strip()}

def _direction(serial, name=""):
    """Return 'In' / 'Out' for a punch. Serial config wins; else infer from name."""
    if serial in ESSL_IN_SERIALS:
        return "In"
    if serial in ESSL_OUT_SERIALS:
        return "Out"
    n = (name or "").lower()
    if "out" in n:
        return "Out"
    if "in" in n:
        return "In"
    return name or ""

# Office policy
LATE_AFTER = (9, 0)                   # Shift 1 (default): In after 09:00 = late
SHIFT_STARTS = {                      # per-shift start time; value in the sheet's 'shift' column
    "1": (9, 0),
    "2": (11, 30),                    # 2nd shift 11:30 AM - 8:00 PM: late after 11:30
}
DEFAULT_SHIFT_START = LATE_AFTER
WORKING_WEEKDAYS = {0, 1, 2, 3, 4, 5}  # Mon-Sat count as working days (adjust if 5-day week)

# Who may see the FULL company live view (besides admins/directors)
BIOMETRIC_FULL_EMAILS = {"pardhasaradhi@showtimeconsulting.in","khushboo@showtimeconsulting.in","rs@showtimeconsulting.in","alimpan@showtimeconsulting.in","at@showtimeconsulting.in"}

async def require_biometric_admin(user=Depends(get_current_user)):
    """Full company view: admins/directors, or explicitly allowed emails."""
    designation = (user.get("designation") or user.get("Designation") or "").lower()
    email = (user.get("email") or user.get("Email ID") or "").lower()
    if user.get("isAdmin") or "admin" in designation or "director" in designation \
       or email in BIOMETRIC_FULL_EMAILS:
        return user
    raise HTTPException(403, "Not authorized for the full biometric view")

def _is_late(dt_ist, shift_start=DEFAULT_SHIFT_START):
    return (dt_ist.hour, dt_ist.minute) > shift_start

def _late_by(dt_ist, shift_start=DEFAULT_SHIFT_START):
    """How long after the employee's shift start their first punch was (HH:MM:SS)."""
    shift = dt_ist.replace(hour=shift_start[0], minute=shift_start[1], second=0, microsecond=0)
    if dt_ist <= shift:
        return "00:00:00"
    secs = int((dt_ist - shift).total_seconds())
    return f"{secs // 3600:02d}:{(secs % 3600) // 60:02d}:{secs % 60:02d}"

async def _shift_map():
    """Return {empCode: (hour, minute)} shift-start per employee, from the user
    docs' 'shift' field. Anyone without a recognised shift uses shift 1 (09:00)."""
    shifts = {}
    try:
        collection_names = await stc_db.list_collection_names()
    except Exception:
        return shifts
    for cname in collection_names:
        if cname.startswith("system.") or cname in ("facebook_posts", "ap_mapping"):
            continue
        try:
            cur = stc_db[cname].find({}, {"_id": 0, "empCode": 1, "Emp code": 1, "shift": 1})
            async for u in cur:
                code = str(u.get("empCode") or u.get("Emp code") or "").strip()
                if not code:
                    continue
                key = str(u.get("shift") or "").strip()
                if key in SHIFT_STARTS:
                    shifts[code] = SHIFT_STARTS[key]
        except Exception as e:
            logger.debug("shift read in %s failed: %s", cname, e)
    return shifts

async def ensure_indexes():
    # Dedup key now includes serial so the same person can punch on both devices.
    try:
        await PUNCHES.drop_index("uniq_punch")   # remove old (user_id, punch_time) index if present
    except Exception:
        pass
    await PUNCHES.create_index([("user_id", 1), ("punch_time", 1), ("serial", 1)],
                               unique=True, name="uniq_punch_dev")
    await PUNCHES.create_index("punch_time")

async def _read_stored(start, end):
    rows = await PUNCHES.find({"punch_time": {"$gte": start, "$lte": end}}, {"_id": 0}).to_list(None)
    for r in rows:
        pt = r.get("punch_time")
        if isinstance(pt, datetime) and pt.tzinfo is None:
            r["punch_time"] = pt.replace(tzinfo=timezone.utc)   # Mongo returns naive UTC
    return rows

async def _acquire(start, end):
    """Return (punches, device_reports) honoring ESSL_SOURCE.
    - store  : read from Mongo only (AWS/cloud; office agent populates it)
    - device : call devices; if all unreachable, fall back to stored."""
    if ESSL_SOURCE == "store":
        return await _read_stored(start, end), []
    try:
        return get_all_punches(start, end)          # raises ESSLConfigError -> caller 503
    except ESSLRequestError:
        return await _read_stored(start, end), []    # all devices down -> serve stored

async def _emp_names(codes):
    """Resolve a set of empCodes to display names from STC_Employees."""
    names = {}
    codes = {str(c) for c in codes if c}
    if not codes:
        return names
    try:
        collection_names = await stc_db.list_collection_names()
    except Exception:
        return names
    for cname in collection_names:
        if cname.startswith("system."):
            continue
        coll = stc_db[cname]
        try:
            cur = coll.find(
                {"$or": [{"empCode": {"$in": list(codes)}}, {"Emp code": {"$in": list(codes)}}]},
                {"_id": 0, "name": 1, "Name": 1, "empCode": 1, "Emp code": 1})
            async for u in cur:
                code = str(u.get("empCode") or u.get("Emp code") or "")
                nm = u.get("name") or u.get("Name")
                if code and nm:
                    names[code] = nm
        except Exception as e:
            logger.debug("name lookup in %s failed: %s", cname, e)
    return names

async def _all_employees():
    """Return {empCode: name} for EVERY employee across STC_Employees collections.
    Used for the roster total and present/absent stats."""
    roster = {}
    try:
        collection_names = await stc_db.list_collection_names()
    except Exception:
        return roster
    for cname in collection_names:
        if cname.startswith("system.") or cname in ("facebook_posts", "ap_mapping"):
            continue
        try:
            cur = stc_db[cname].find({}, {"_id": 0, "name": 1, "Name": 1,
                                          "empCode": 1, "Emp code": 1})
            async for u in cur:
                code = str(u.get("empCode") or u.get("Emp code") or "").strip()
                if not code:
                    continue
                nm = u.get("name") or u.get("Name")
                if code not in roster or (nm and roster[code] == "—"):
                    roster[code] = nm or "—"
        except Exception as e:
            logger.debug("roster read in %s failed: %s", cname, e)
    return roster

def _break_delta(items):
    """Time spent OUT of office across the day (Out->In round trips).
    items = sorted [{t, dir}]. Starts 'inside', so the first-in punch and the
    final unmatched last-out are naturally excluded."""
    state = "in"
    outside_since = None
    total = timedelta(0)
    for it in items[1:]:  # leave out the 1st (arrival) punch
        d = it.get("dir")
        if d == "Out" and state == "in":
            state = "out"
            outside_since = it["t"]
        elif d == "In" and state == "out":
            total += it["t"] - outside_since
            state = "in"
            outside_since = None
    return total

def _total_break_time(items):
    mins = int(_break_delta(items).total_seconds() // 60)
    return f"{mins // 60:02d}:{mins % 60:02d}"

def _working_hours(items):
    """Actual worked time = (last punch - first punch) - break time."""
    if len(items) < 2:
        return ""
    span = items[-1]["t"] - items[0]["t"]
    work = span - _break_delta(items)
    if work.total_seconds() < 0:
        work = timedelta(0)
    return _fmt_hm(work)

def _day_bounds(date_str):
    if date_str:
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(400, "Invalid date. Use YYYY-MM-DD.")
    else:
        d = datetime.now(IST)
    start = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=IST)
    end = datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=IST)
    return start, end

async def _store(punches):
    new = 0
    for p in punches:
        res = await PUNCHES.update_one(
            {"user_id": p["user_id"], "punch_time": p["punch_time"], "serial": p.get("serial", "")},
            {"$setOnInsert": {"user_id": p["user_id"], "punch_time": p["punch_time"],
                              "serial": p.get("serial", ""), "device": p.get("device", ""),
                              "extra": p.get("extra", []), "source": "essl"}},
            upsert=True)
        if res.upserted_id is not None:
            new += 1
    return new

def _shape(p):
    pt = p["punch_time"]
    return {"user_id": p["user_id"], "device": p.get("device", ""), "serial": p.get("serial", ""),
            "punch_time": pt.isoformat() if isinstance(pt, datetime) else pt,
            "extra": p.get("extra", [])}

@router.get("/live")
async def live(date: str = Query(None), admin=Depends(require_biometric_admin)):
    start, end = _day_bounds(date)
    try:
        punches, devices = await _acquire(start, end)
    except ESSLConfigError as e:
        raise HTTPException(503, f"eSSL not configured: {e}")
    if ESSL_SOURCE != "store":
        await _store(punches)
    shaped = sorted((_shape(p) for p in punches), key=lambda x: x["punch_time"], reverse=True)
    return {"count": len(shaped), "devices": devices,
            "from": start.isoformat(), "to": end.isoformat(), "punches": shaped}

@router.get("/summary")
async def summary(date: str = Query(None), admin=Depends(require_biometric_admin)):
    start, end = _day_bounds(date)
    try:
        punches, devices = await _acquire(start, end)
    except ESSLConfigError as e:
        raise HTTPException(503, f"eSSL not configured: {e}")
    if ESSL_SOURCE != "store":
        await _store(punches)

    # relabel device pills as In/Out based on serial direction
    for d in devices:
        d["device"] = _direction(d.get("serial", ""), d.get("device", ""))

    # group full punch objects (time + direction) per employee
    by_emp = {}
    for p in punches:
        pt = p["punch_time"]
        if not isinstance(pt, datetime):
            pt = datetime.fromisoformat(pt)
        by_emp.setdefault(p["user_id"], []).append(
            {"t": pt, "dir": _direction(p.get("serial", ""), p.get("device", ""))})

    roster = await _all_employees()   # {empCode: name} for the whole company
    shift_map = await _shift_map()    # {empCode: (h, m)} shift start

    out = []
    for uid, items in by_emp.items():
        items.sort(key=lambda x: x["t"])
        first, last = items[0], items[-1]
        first_ist = first["t"].astimezone(IST)
        # breaks = the punches between first-in and last-out
        middle = items[1:-1] if len(items) > 2 else []
        breaks = [{"time": m["t"].astimezone(IST).strftime("%H:%M"), "device": m["dir"]} for m in middle]
        out.append({
            "user_id": uid,
            "emp_name": roster.get(str(uid), "—"),
            "first_in": first_ist.strftime("%H:%M"),
            "first_in_device": first["dir"],
            "late": _is_late(first_ist, shift_map.get(str(uid), DEFAULT_SHIFT_START)),
            "last_out": last["t"].astimezone(IST).strftime("%H:%M") if len(items) > 1 else "",
            "last_out_device": last["dir"] if len(items) > 1 else "",
            "breaks": breaks,
            "break_time": _total_break_time(items),
            "working_hours": _working_hours(items),
            "punch_count": len(items),
        })
    out.sort(key=lambda x: (x["emp_name"] == "—", x["emp_name"], x["user_id"]))

    # stats: total roster vs who punched today
    total_emp = len(roster)
    present = len(set(str(u) for u in by_emp.keys()) & set(roster.keys()))
    absent = max(0, total_emp - present)
    stats = {"total_employees": total_emp, "present": present, "absent": absent,
             "punched_today": len(by_emp)}

    return {"date": start.date().isoformat(), "employees": out, "total": len(out),
            "devices": devices, "stats": stats}

@router.get("/punches")
async def stored(date: str = Query(None), admin=Depends(require_biometric_admin)):
    start, end = _day_bounds(date)
    rows = await PUNCHES.find({"punch_time": {"$gte": start, "$lte": end}}, {"_id": 0}) \
                        .sort("punch_time", -1).to_list(None)
    for r in rows:
        if isinstance(r.get("punch_time"), datetime):
            r["punch_time"] = r["punch_time"].astimezone(IST).isoformat()
    return {"count": len(rows), "punches": rows}

class SyncRequest(BaseModel):
    from_date: str = None
    to_date: str = None
    roll_up: bool = True

def _fmt_hm(delta):
    mins = int(delta.total_seconds() // 60)
    return f"{mins // 60:02d}:{mins % 60:02d}"

@router.post("/sync")
async def sync(req: SyncRequest, admin=Depends(require_biometric_admin)):
    start, _ = _day_bounds(req.from_date)
    _, end = _day_bounds(req.to_date or req.from_date)
    if end < start:
        raise HTTPException(400, "to_date is before from_date")
    try:
        punches, devices = get_all_punches(start, end)
    except ESSLConfigError as e:
        raise HTTPException(503, f"eSSL not configured: {e}")
    except ESSLRequestError as e:
        raise HTTPException(502, f"eSSL device error: {e}")
    new = await _store(punches)
    rolled = 0
    if req.roll_up:
        # Across BOTH devices: earliest punch of the day = in, latest = out.
        by_emp_day = {}
        for p in punches:
            day = p["punch_time"].astimezone(IST).strftime("%Y-%m-%d")
            by_emp_day.setdefault((p["user_id"], day), []).append(p["punch_time"])
        for (emp_code, day), times in by_emp_day.items():
            times.sort()
            in_t, out_t = times[0], times[-1]
            shift = in_t.replace(hour=SHIFT_START[0], minute=SHIFT_START[1], second=0, microsecond=0)
            late = max(timedelta(0), in_t - shift)
            record = {"date": datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=timezone.utc),
                      "status": "P", "inTime": in_t.strftime("%H:%M"),
                      "outTime": out_t.strftime("%H:%M") if len(times) > 1 else "",
                      "lateBy": _fmt_hm(late), "totalWorkingHours": _fmt_hm(out_t - in_t)}
            await ATTENDANCE.update_one({"empCode": emp_code},
                {"$pull": {"dailyRecords": {"date": record["date"]}}})
            await ATTENDANCE.update_one({"empCode": emp_code},
                {"$setOnInsert": {"empCode": emp_code, "empName": emp_code},
                 "$push": {"dailyRecords": record}}, upsert=True)
            rolled += 1
    return {"fetched": len(punches), "new_stored": new, "devices": devices,
            "attendance_days_updated": rolled}


# ------------------------------------------------------------------ #
# Employee / Manager attendance (daily records + totals) from punches
# ------------------------------------------------------------------ #
from attendance import find_manager_details_by_code  # team resolver (reviewer-based)

def _range_bounds(from_date, to_date):
    today = datetime.now(IST).date()
    try:
        to_d = datetime.strptime(to_date, "%Y-%m-%d").date() if to_date else today
        from_d = datetime.strptime(from_date, "%Y-%m-%d").date() if from_date else today.replace(day=1)
    except ValueError:
        raise HTTPException(400, "Invalid date. Use YYYY-MM-DD.")
    if (to_d - from_d).days > 92:
        raise HTTPException(400, "Range too large (max ~3 months).")
    start = datetime(from_d.year, from_d.month, from_d.day, 0, 0, 0, tzinfo=IST)
    end = datetime(to_d.year, to_d.month, to_d.day, 23, 59, 59, tzinfo=IST)
    return from_d, to_d, start, end

def _working_days(from_d, to_d):
    n, d = 0, from_d
    while d <= to_d:
        if d.weekday() in WORKING_WEEKDAYS:
            n += 1
        d += timedelta(days=1)
    return n

def _day_record(day, items, shift_start=DEFAULT_SHIFT_START):
    items.sort(key=lambda x: x["t"])
    first, last = items[0], items[-1]
    fin = first["t"].astimezone(IST)
    multi = len(items) > 1
    middle = items[1:-1] if len(items) > 2 else []
    breaks = [{"time": m["t"].astimezone(IST).strftime("%H:%M"), "device": m["dir"]} for m in middle]
    return {
        "date": day.isoformat(),
        "weekday": day.strftime("%a"),
        "status": "Present",
        "first_in": fin.strftime("%H:%M"),
        "first_in_device": first["dir"],
        "late": _is_late(fin, shift_start),
        "late_by": _late_by(fin, shift_start),
        "last_out": last["t"].astimezone(IST).strftime("%H:%M") if multi else "",
        "last_out_device": last["dir"] if multi else "",
        "breaks": breaks,
        "break_time": _total_break_time(items),
        "working_hours": _working_hours(items),
        "punch_count": len(items),
    }

async def _attendance_for(codes, from_date, to_date, want_days=True):
    """Build per-employee daily records + totals for the given empCodes."""
    from_d, to_d, start, end = _range_bounds(from_date, to_date)
    try:
        punches, _ = await _acquire(start, end)
    except ESSLConfigError as e:
        raise HTTPException(503, f"eSSL not configured: {e}")
    if ESSL_SOURCE != "store":
        await _store(punches)

    codeset = {str(c) for c in codes}
    grouped = {}   # (code, day) -> [items]
    for p in punches:
        uid = str(p["user_id"])
        if uid not in codeset:
            continue
        pt = p["punch_time"]
        if not isinstance(pt, datetime):
            pt = datetime.fromisoformat(pt)
        day = pt.astimezone(IST).date()
        grouped.setdefault((uid, day), []).append(
            {"t": pt, "dir": _direction(p.get("serial", ""), p.get("device", ""))})

    roster = await _all_employees()
    shift_map = await _shift_map()
    today = datetime.now(IST).date()
    working = _working_days(from_d, to_d)

    def _empty_day(d, status):
        return {"date": d.isoformat(), "weekday": d.strftime("%a"), "status": status,
                "first_in": "", "first_in_device": "", "late": False, "late_by": "00:00:00",
                "last_out": "", "last_out_device": "", "breaks": [], "break_time": "00:00",
                "working_hours": "", "punch_count": 0}

    employees = []
    for code in codes:
        code = str(code)
        _ss = shift_map.get(code, DEFAULT_SHIFT_START)
        day_map = {d: _day_record(d, grouped[(c, d)], _ss) for (c, d) in grouped if c == code}
        # build a record for every day in the range
        days, present, absent, late_cnt = [], 0, 0, 0
        d = from_d
        while d <= to_d:
            if d in day_map:
                rec = day_map[d]
                present += 1
                if rec["late"]:
                    late_cnt += 1
                days.append(rec)
            elif d.weekday() == 6:        # Sunday = week off
                days.append(_empty_day(d, "Week Off"))
            elif d <= today:
                absent += 1
                days.append(_empty_day(d, "Absent"))
            else:
                days.append(_empty_day(d, ""))   # future day, blank
            d += timedelta(days=1)
        today_rec = next((r for r in days if r["date"] == today.isoformat() and r["status"] == "Present"), None)
        employees.append({
            "emp_code": code,
            "emp_name": roster.get(code, "—"),
            "days": days if want_days else [],
            "present_days": present,
            "absent_days": absent,
            "late_days": late_cnt,
            "working_days": working,
            "today": today_rec,
        })
    return {"from": from_d.isoformat(), "to": to_d.isoformat(),
            "working_days": working, "employees": employees}


@router.get("/me")
async def my_attendance(from_date: str = Query(None), to_date: str = Query(None),
                        user=Depends(get_current_user)):
    """Logged-in employee's own daily attendance + totals."""
    emp_code = str(user.get("empCode") or user.get("Emp code") or "").strip()
    if not emp_code:
        raise HTTPException(400, "No employee code found on your profile.")
    data = await _attendance_for([emp_code], from_date, to_date, want_days=True)
    emp = data["employees"][0] if data["employees"] else None
    return {"from": data["from"], "to": data["to"], "working_days": data["working_days"],
            "employee": emp}


@router.get("/team")
async def team_attendance(from_date: str = Query(None), to_date: str = Query(None),
                          user=Depends(get_current_user)):
    """Manager's reportees: per-employee totals + today's status."""
    emp_code = str(user.get("empCode") or user.get("Emp code") or "").strip()
    if not emp_code:
        raise HTTPException(400, "No employee code found on your profile.")
    details = await find_manager_details_by_code(emp_code, stc_db)
    team = details.get("team") or []
    codes = [str(t.get("empCode") or t.get("Emp code") or "").strip()
             for t in team if (t.get("empCode") or t.get("Emp code"))]
    codes = [c for c in codes if c]
    if not codes:
        raise HTTPException(403, "No team found for your account.")
    data = await _attendance_for(codes, from_date, to_date, want_days=True)
    tp = sum(e["present_days"] for e in data["employees"])
    ta = sum(e["absent_days"] for e in data["employees"])
    tl = sum(e["late_days"] for e in data["employees"])
    present_today = sum(1 for e in data["employees"] if e.get("today"))
    data["manager"] = details.get("managerName")
    data["team_totals"] = {"members": len(codes), "present_days": tp, "absent_days": ta,
                           "late_days": tl, "present_today": present_today,
                           "absent_today": len(codes) - present_today}
    return data


@router.get("/company")
async def company_attendance(from_date: str = Query(None), to_date: str = Query(None),
                             admin=Depends(require_biometric_admin)):
    """Full company day-wise attendance over a range (admin / pardhasaradhi).
    Same shape as /team so the frontend reuses the collapsible view."""
    roster = await _all_employees()
    codes = [c for c in roster.keys() if c]
    if not codes:
        raise HTTPException(404, "No employees found.")
    data = await _attendance_for(codes, from_date, to_date, want_days=True)
    data["employees"].sort(key=lambda e: (e["emp_name"] == "—", e["emp_name"], e["emp_code"]))
    tp = sum(e["present_days"] for e in data["employees"])
    ta = sum(e["absent_days"] for e in data["employees"])
    tl = sum(e["late_days"] for e in data["employees"])
    present_today = sum(1 for e in data["employees"] if e.get("today"))
    data["team_totals"] = {"members": len(codes), "present_days": tp, "absent_days": ta,
                           "late_days": tl, "present_today": present_today,
                           "absent_today": len(codes) - present_today}
    return data


@router.get("/employee/{emp_code}")
async def employee_attendance(emp_code: str, from_date: str = Query(None),
                              to_date: str = Query(None), user=Depends(get_current_user)):
    """Drill-down for one employee. Allowed for self, their manager, or admins."""
    my_code = str(user.get("empCode") or user.get("Emp code") or "").strip()
    email = (user.get("email") or user.get("Email ID") or "").lower()
    designation = (user.get("designation") or user.get("Designation") or "").lower()
    is_full = user.get("isAdmin") or "admin" in designation or "director" in designation \
              or email in BIOMETRIC_FULL_EMAILS
    allowed = is_full or my_code == str(emp_code)
    if not allowed:
        details = await find_manager_details_by_code(my_code, stc_db)
        team_codes = {str(t.get("empCode") or t.get("Emp code") or "") for t in (details.get("team") or [])}
        allowed = str(emp_code) in team_codes
    if not allowed:
        raise HTTPException(403, "Not authorized to view this employee.")
    data = await _attendance_for([str(emp_code)], from_date, to_date, want_days=True)
    return {"from": data["from"], "to": data["to"], "working_days": data["working_days"],
            "employee": data["employees"][0] if data["employees"] else None}
