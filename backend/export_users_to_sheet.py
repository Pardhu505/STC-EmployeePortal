"""
export_users_to_sheet.py
------------------------
Export existing portal users INTO the Google Sheet. Run on the AWS server.

    cd /home/ubuntu/STC-EmployeePortal/backend
    source venv/bin/activate
    python export_users_to_sheet.py

Env used (from .env):
    ATTENDANCE_MONGO_URL or MONGO_URL   Atlas connection string
    DB_NAME                             (defaults to internal_communication)
    GOOGLE_SHEETS_CREDENTIALS           service-account JSON (single line!)
    USERS_SHEET_URL                     sheet to write to

Creates its OWN Mongo client (avoids the 'attached to a different loop' error).
OVERWRITES the first worksheet with current users. 'password' column left blank.
"""
import os
import json
import asyncio
import logging

import gspread
from google.oauth2.service_account import Credentials
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("export-users")

MONGO_URL = os.getenv("MONGO_URL") or os.getenv("ATTENDANCE_MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "internal_communication")
SHEET_URL = os.getenv(
    "USERS_SHEET_URL",
    "https://docs.google.com/spreadsheets/d/1QJ6JqvDoTlmAh2P_D2Atut2WhguHCFMzmRYLOyiijrI/edit?gid=0#gid=0",
)

HEADERS = ["name", "email", "empCode", "team", "designation", "department",
           "phone", "date_of_birth", "reviewer", "password"]
SKIP_COLLECTIONS = {"facebook_posts", "ap_mapping"}


def _cell(u, key):
    v = u.get(key, "")
    if v is None:
        return ""
    try:
        return v.strftime("%Y-%m-%d")
    except AttributeError:
        return str(v)


async def gather_users(db):
    users, seen = [], set()
    for cname in await db.list_collection_names():
        if cname.startswith("system.") or cname in SKIP_COLLECTIONS:
            continue
        async for u in db[cname].find({}, {"_id": 0, "password_hash": 0}):
            email = u.get("email")
            if not email:
                continue
            e = str(email).lower()
            if e in seen:
                continue
            seen.add(e)
            users.append(u)
    return users


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
        rows.append([_cell(u, h) if h != "password" else "" for h in HEADERS])
    ws.clear()
    ws.update(rows, value_input_option="RAW")
    log.info("Wrote %d users to the sheet.", len(users))


async def main():
    if not MONGO_URL:
        raise SystemExit("MONGO_URL / ATTENDANCE_MONGO_URL not set in .env")
    client = AsyncIOMotorClient(MONGO_URL, tlsAllowInvalidCertificates=True)
    db = client[DB_NAME]
    users = await gather_users(db)
    log.info("Found %d users.", len(users))
    write_sheet(users)
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
