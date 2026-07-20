"""
sync_users_from_sheet.py
------------------------
Create portal users from rows in the Google Sheet. Reuses the portal's own
signup() logic, so reviewer calculation, team-collection routing, and password
hashing behave EXACTLY like a normal signup. Existing users (matched by email)
are skipped, so it's safe to re-run.

Run on the AWS server:
    cd /home/ubuntu/STC-EmployeePortal/backend
    source venv/bin/activate
    python sync_users_from_sheet.py

Env used:
    GOOGLE_SHEETS_CREDENTIALS   service-account JSON (already set for sheets.py)
    USERS_SHEET_URL             the sheet to read (falls back to the one below)
    DEFAULT_USER_PASSWORD       password for rows with a blank 'password' cell
                                (default: Showtime@123 — users should reset it)

Sheet columns (case-insensitive; extra columns ignored):
    name, email, team, empCode, designation, department, phone,
    emergency_contact, date_of_birth, password
'team' must be one of the portal's valid TEAMS, or the row is reported as failed.
"""
import os
import asyncio
import logging

from fastapi import HTTPException
from dotenv import load_dotenv

from sheets import get_data_from_sheet
from models import SignupRequest
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
    """Case-insensitive column lookup; returns '' if not present/blank."""
    lowered = {str(k).strip().lower(): v for k, v in row.items()}
    for a in aliases:
        if a in lowered and lowered[a] is not None:
            return str(lowered[a]).strip()
    return ""


async def main():
    rows = get_data_from_sheet(SHEET_URL)
    log.info("Read %d rows from the sheet.", len(rows))

    created = skipped = failed = 0
    for i, row in enumerate(rows, start=2):  # row 1 is headers
        email = pick(row, "email")
        if not email:
            continue
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
            detail = str(e.detail)
            if "already exists" in detail.lower():
                skipped += 1
            else:
                failed += 1
                log.warning("row %d: FAILED %s -> %s", i, email, detail)
        except Exception as e:
            failed += 1
            log.warning("row %d: FAILED %s -> %s", i, email, e)

    log.info("Done. created=%d  skipped(existing)=%d  failed=%d", created, skipped, failed)


if __name__ == "__main__":
    asyncio.run(main())
