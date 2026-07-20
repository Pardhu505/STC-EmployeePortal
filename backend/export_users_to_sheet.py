"""
export_users_to_sheet.py
------------------------
One-time / on-demand export of existing portal users INTO the Google Sheet, so
the sheet becomes the place you manage the roster. Run on the AWS server (it has
Atlas access and the GOOGLE_SHEETS_CREDENTIALS env var).

    cd /home/ubuntu/STC-EmployeePortal/backend
    source venv/bin/activate
    python export_users_to_sheet.py

Env used:
    GOOGLE_SHEETS_CREDENTIALS   the service-account JSON (already set for sheets.py)
    USERS_SHEET_URL             the sheet to write to (falls back to the one below)

NOTE: this OVERWRITES the first worksheet with the current users (headers + rows).
The 'password' column is intentionally left blank — never export password hashes.
"""
import os
import json
import asyncio
import logging

import gspread
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv

from database import stc_db

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("export-users")

SHEET_URL = os.getenv(
    "USERS_SHEET_URL",
    "https://docs.google.com/spreadsheets/d/1QJ6JqvDoTlmAh2P_D2Atut2WhguHCFMzmRYLOyiijrI/edit?gid=0#gid=0",
)

# Column order written to the sheet. 'password' stays blank (for new rows you add).
HEADERS = ["name", "email", "empCode", "team", "designation", "department",
           "phone", "date_of_birth", "reviewer", "password"]

# Collections in stc_db that are NOT user teams
SKIP_COLLECTIONS = {"facebook_posts", "ap_mapping"}


async def gather_users():
    users = []
    for cname in await stc_db.list_collection_names():
        if cname.startswith("system.") or cname in SKIP_COLLECTIONS:
            continue
        async for u in stc_db[cname].find({}, {"_id": 0, "password_hash": 0}):
            if not u.get("email"):
                continue
            users.append(u)
    # de-dup by email, keep first
    seen, unique = set(), []
    for u in users:
        e = str(u.get("email")).lower()
        if e in seen:
            continue
        seen.add(e)
        unique.append(u)
    return unique


def _cell(u, key):
    v = u.get(key, "")
    if v is None:
        return ""
    # dates -> YYYY-MM-DD
    try:
        return v.strftime("%Y-%m-%d")
    except AttributeError:
        return str(v)


def write_sheet(users):
    creds_json = os.environ.get("GOOGLE_SHEETS_CREDENTIALS")
    if not creds_json:
        raise SystemExit("GOOGLE_SHEETS_CREDENTIALS env var not set.")
    scopes = ["https://www.googleapis.com/auth/spreadsheets",
              "https://www.googleapis.com/auth/drive"]
    creds = Credentials.from_service_account_info(json.loads(creds_json), scopes=scopes)
    gc = gspread.authorize(creds)
    ws = gc.open_by_url(SHEET_URL).sheet1

    rows = [HEADERS]
    for u in users:
        row = [_cell(u, h) if h != "password" else "" for h in HEADERS]
        rows.append(row)

    ws.clear()
    ws.update(rows, value_input_option="RAW")
    log.info("Wrote %d users to the sheet (first worksheet).", len(users))


async def main():
    users = await gather_users()
    write_sheet(users)


if __name__ == "__main__":
    asyncio.run(main())
