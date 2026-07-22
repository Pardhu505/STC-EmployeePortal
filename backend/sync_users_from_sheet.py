"""
sync_users_from_sheet.py
------------------------
Create portal users from the Google Sheet, reusing the portal's signup logic.

Handles messy 'team' cells via TEAM_ALIASES below: typos are corrected, and
values that are really job ROLES (ACM, Intern, Co-Lead(PMU)...) are mapped to a
real team, with the role moved into 'designation' when that column is blank.

USAGE
    python sync_users_from_sheet.py --dry-run    # preview, writes NOTHING
    python sync_users_from_sheet.py              # actually create users

Always run --dry-run first and check the mapping summary.
"""
import os
import re
import sys
import asyncio
import logging

from fastapi import HTTPException
from dotenv import load_dotenv

from sheets import get_data_from_sheet
from models import SignupRequest, TEAMS
from database import stc_db
import profile as profile_mod

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("sync-users")

SHEET_URL = os.getenv(
    "USERS_SHEET_URL",
    "https://docs.google.com/spreadsheets/d/1QJ6JqvDoTlmAh2P_D2Atut2WhguHCFMzmRYLOyiijrI/edit?gid=0#gid=0",
)
DEFAULT_PASSWORD = os.getenv("DEFAULT_USER_PASSWORD", "Showtime@123")
DRY_RUN = "--dry-run" in sys.argv

# ---------------------------------------------------------------- #
# Sheet 'team' value  ->  (real team, designation to use if blank)
# Lines marked REVIEW are my best guess - change the team if wrong.
# ---------------------------------------------------------------- #
TEAM_ALIASES = {
    # --- plain typos / variants ---
    "reasearch":                  ("Research", None),
    "reasearch lead":             ("Research", "Research Lead"),
    "directors team":             ("Directors Team-1", None),          # REVIEW (-1/-2/-3?)
    'director"s team':            ("Directors Team-1", None),          # REVIEW
    "dmc":                        ("Digital Communication", None),     # REVIEW (DMC is a dept)
    "admin":                      ("Operations", None),                # REVIEW (Operations/System Admin)
    "field":                      ("Field Team AP-1", None),           # REVIEW
    "soul field":                 ("Soul Central", None),              # REVIEW

    # --- roles that name their team in brackets ---
    "co-lead(pmu)":               ("PMU", "Co-Lead"),
    "dmc(videographer)":          ("Digital Production", "Videographer"),
    "video editor(dmc)":          ("Digital Production", "Video Editor"),
    "page manager(dmc)":          ("Digital Communication", "Page Manager"),
    "marketing team(dmc) lead":   ("Digital Marketing/Networking", "Marketing Lead"),

    # --- roles with an obvious team ---
    "campaign manager":           ("Campaign", "Campaign Manager"),
    "content writter":            ("Digital Communication", "Content Writer"),
    "video/photo grapher":        ("Digital Production", "Videographer/Photographer"),

    # --- field roles / hierarchy levels ---
    "acm":                        ("Field Team AP-1", "ACM"),          # REVIEW (26 people!)
    "apoc":                       ("Field Team AP-1", "APOC"),         # REVIEW
    "assembly level":             ("Field Team AP-1", "Assembly Level"),  # REVIEW
    "zonal":                      ("Field Team AP-1", "Zonal"),        # REVIEW
    "state lead":                 ("PMU", "State Lead"),               # REVIEW

    # --- generic roles ---
    "manager":                    ("Operations", "Manager"),           # REVIEW
    "intern":                     ("Research", "Intern"),              # REVIEW
}


def norm(s):
    """lowercase, strip, collapse whitespace/newlines, normalise smart quotes."""
    s = str(s or "").replace("\r", " ").replace("\n", " ")
    s = s.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")
    return re.sub(r"\s+", " ", s).strip().lower()


def pick(row, *aliases):
    lowered = {norm(k): v for k, v in row.items()}
    for a in aliases:
        if a in lowered and lowered[a] is not None:
            return str(lowered[a]).replace("\n", " ").strip()
    return ""


def resolve_team(raw_team):
    """Return (team, designation_override, note)."""
    n = norm(raw_team)
    if not n:
        return "", None, "blank"
    for t in TEAMS:                      # already valid (case-insensitive)
        if norm(t) == n:
            return t, None, "exact"
    if n in TEAM_ALIASES:
        team, desig = TEAM_ALIASES[n]
        return team, desig, "alias"
    return raw_team, None, "UNMAPPED"


async def set_shift(email, shift):
    for cname in await stc_db.list_collection_names():
        if cname.startswith("system."):
            continue
        res = await stc_db[cname].update_one({"email": email}, {"$set": {"shift": shift}})
        if res.matched_count:
            return True
    return False


async def main():
    rows = get_data_from_sheet(SHEET_URL)
    log.info("Read %d rows from the sheet.%s", len(rows), "  [DRY RUN - nothing will be written]" if DRY_RUN else "")

    created = skipped = failed = shift_set = 0
    mapping_counts, unmapped = {}, {}

    for i, row in enumerate(rows, start=2):
        email = pick(row, "email")
        if not email:
            continue

        raw_team = pick(row, "team")
        team, desig_override, note = resolve_team(raw_team)
        if note == "alias":
            mapping_counts[f"{raw_team!r} -> {team}"] = mapping_counts.get(f"{raw_team!r} -> {team}", 0) + 1
        elif note == "UNMAPPED":
            unmapped[raw_team] = unmapped.get(raw_team, 0) + 1

        designation = pick(row, "designation") or desig_override or None
        shift = pick(row, "shift")

        if DRY_RUN:
            continue

        req = SignupRequest(
            name=pick(row, "name"),
            email=email,
            password=pick(row, "password") or DEFAULT_PASSWORD,
            team=team,
            empCode=pick(row, "empcode", "emp code", "emp_code", "employee code"),
            designation=designation,
            department=pick(row, "department") or None,
            phone=pick(row, "phone", "mobile") or None,
            emergency_contact=pick(row, "emergency_contact", "emergency contact") or None,
            date_of_birth=pick(row, "date_of_birth", "dob", "date of birth") or None,
        )
        try:
            await profile_mod.signup(req)
            created += 1
            log.info("row %d: created %s  (team=%s)", i, email, team)
        except HTTPException as e:
            if "already exists" in str(e.detail).lower():
                skipped += 1
            else:
                failed += 1
                log.warning("row %d: FAILED %s -> %s", i, email, e.detail)
                continue
        except Exception as e:
            failed += 1
            log.warning("row %d: FAILED %s -> %s", i, email, e)
            continue

        if shift in ("1", "2") and await set_shift(email, shift):
            shift_set += 1

    print("\n--- TEAM MAPPING APPLIED ---")
    for k, v in sorted(mapping_counts.items(), key=lambda x: -x[1]):
        print(f"  {v:3d}  {k}")
    if unmapped:
        print("\n--- STILL UNMAPPED (these rows will fail) ---")
        for k, v in sorted(unmapped.items(), key=lambda x: -x[1]):
            print(f"  {v:3d}  {k!r}")
    else:
        print("\nNo unmapped teams. ✅")

    if DRY_RUN:
        print("\nDRY RUN - nothing was written. Re-run without --dry-run to apply.")
    else:
        log.info("Done. created=%d  skipped(existing)=%d  failed=%d  shift_updated=%d",
                 created, skipped, failed, shift_set)


if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(main())
