"""
sync_users_from_sheet.py
------------------------
Create portal users from Google Sheet rows (reusing the portal's signup logic),
and set each user's 'shift' from the sheet's 'shift' column.

    shift = 1  -> 1st shift, late after 09:00 (default)
    shift = 2  -> 2nd shift, late after 11:30

Existing users are NOT recreated, but their 'shift' IS updated on every run — so
to move someone between shifts, change the cell and re-run.

Run on the AWS server:
    cd /home/ubuntu/STC-EmployeePortal/backend
    source venv/bin/activate
    python sync_users_from_sheet.py

Env: GOOGLE_SHEETS_CREDENTIALS, USERS_SHEET_URL, DEFAULT_USER_PASSWORD (opt).
"""
import os
import asyncio
import logging

from fastapi import HTTPException
from dotenv import load_dotenv

from sheets import get_data_from_sheet
from models import SignupRequest
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


def pick(row, *aliases):
    lowered = {str(k).strip().lower(): v for k, v in row.items()}
    for a in aliases:
        if a in lowered and lowered[a] is not None:
            return str(lowered[a]).strip()
    return ""


async def set_shift(email, shift):
    """Set the 'shift' field on the user's doc, wherever it lives."""
    for cname in await stc_db.list_collection_names():
        if cname.startswith("system."):
            continue
        res = await stc_db[cname].update_one({"email": email}, {"$set": {"shift": shift}})
        if res.matched_count:
            return True
    return False


async def main():
    rows = get_data_from_sheet(SHEET_URL)
    log.info("Read %d rows from the sheet.", len(rows))

    created = skipped = failed = shift_set = 0
    for i, row in enumerate(rows, start=2):
        email = pick(row, "email")
        if not email:
            continue
        shift = pick(row, "shift")  # "1" / "2" / ""
        req = SignupRequest(
            name=pick(row, "name"),
            email=email,
            password=pick(row, "password") or DEFAULT_PASSWORD,
            team=pick(row, "team"),
            empCode=pick(row, "empcode", "emp code", "emp_code", "employee code"),
            designation=pick(row, "designation") or None,
            department=pick(row, "department") or None,
            phone=pick(row, "phone", "mobile") or None,
            emergency_contact=pick(row, "emergency_contact", "emergency contact") or None,
            date_of_birth=pick(row, "date_of_birth", "dob", "date of birth") or None,
        )
        try:
            await profile_mod.signup(req)
            created += 1
            log.info("row %d: created %s", i, email)
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

        # set/refresh shift for both new and existing users
        if shift in ("1", "2"):
            if await set_shift(email, shift):
                shift_set += 1

    log.info("Done. created=%d  skipped(existing)=%d  failed=%d  shift_updated=%d",
             created, skipped, failed, shift_set)


if __name__ == "__main__":
    # default loop (matches the app's Mongo client) — avoids 'different loop' error
    loop = asyncio.get_event_loop()
    loop.run_until_complete(main())
