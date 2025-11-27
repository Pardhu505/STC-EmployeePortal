import os
import re
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from dotenv import load_dotenv
from pathlib import Path
from typing import List

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Centralized Database Connections ---

# MongoDB connection for the main database (if used)
main_mongo_url = os.environ.get('MONGO_URL')
main_client = AsyncIOMotorClient(main_mongo_url) if main_mongo_url else None
main_db = main_client[os.environ['DB_NAME']] if main_client else None

# MongoDB connection for Attendance, Chat, and STC_Employees (Atlas)
attendance_mongo_url = os.environ.get("ATTENDANCE_MONGO_URL")
attendance_client = AsyncIOMotorClient(attendance_mongo_url, tlsAllowInvalidCertificates=True)

attendance_db = attendance_client['employee_attendance']
chat_db = attendance_client['Internal_communication']
stc_db = attendance_client['STC_Employees']

# GridFS bucket for file storage
grid_fs = AsyncIOMotorGridFSBucket(chat_db)

def get_grid_fs():
    """Dependency function to provide the GridFS bucket."""
    return grid_fs

# --- Database Helper Functions ---

def sanitize_team(team: str) -> str:
    """Sanitize team name for MongoDB collection name."""
    return re.sub(r'[ /-]', '_', team)

async def get_all_employees_emails(db) -> List[str]:
    """Get all unique employee emails from the STC_Employees database."""
    all_emails = set()
    collection_names = await db.list_collection_names()
    team_collections = [db[name] for name in collection_names if not name.startswith('system.')]
    
    for collection in team_collections:
        users = await collection.find({}, {"email": 1, "_id": 0}).to_list(None)
        for u in users:
            if u.get('email'):
                all_emails.add(u['email'])
    return list(all_emails)

async def get_employees_by_department(db, dept_name: str) -> List[str]:
    """Get emails of employees in a specific department from the STC_Employees database."""
    if not dept_name:
        return []
    all_emails = set()
    collection_names = await db.list_collection_names()
    team_collections = [db[name] for name in collection_names if not name.startswith('system.')]
    for collection in team_collections:
        users = await collection.find({"department": re.compile(f"^{re.escape(dept_name)}$", re.IGNORECASE)}, {"email": 1, "_id": 0}).to_list(None)
        for u in users:
            if u.get('email'):
                all_emails.add(u['email'])
    return list(all_emails)

async def get_employee_by_name(db, name: str) -> dict | None:
    """Get employee info by name from the STC_Employees database."""
    if not name:
        return None
    # Use a case-insensitive regex to match the name
    name_regex = re.compile(f"^{re.escape(name)}$", re.I)
    collection_names = await db.list_collection_names()
    team_collections = [db[name] for name in collection_names if not name.startswith('system.')]
    for collection in team_collections:
        # Search in both 'name' and 'Name' fields for flexibility
        user = await collection.find_one(
            {"$or": [{"name": name_regex}, {"Name": name_regex}]},
            {"email": 1, "Email ID": 1, "_id": 0}
        )
        if user:
            # Normalize the email field to always be 'email'
            email = user.get('email') or user.get('Email ID')
            if email:
                return {"email": email}
    return None