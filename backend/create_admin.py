import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from dotenv import load_dotenv
from pathlib import Path
import re

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Database Connection ---
attendance_mongo_url = os.environ.get("ATTENDANCE_MONGO_URL")
attendance_client = AsyncIOMotorClient(attendance_mongo_url, tlsAllowInvalidCertificates=True)
stc_db = attendance_client['STC_Employees']

# --- Password Hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def sanitize_team(team: str) -> str:
    """Sanitize team name for MongoDB collection name."""
    sanitized = re.sub(r'[ /-]', '_', team)
    return sanitized

async def create_admin_user():
    """Creates or updates an admin user with a known password."""
    admin_email = "admin@showtimeconsulting.in"
    admin_password = "password"
    hashed_password = pwd_context.hash(admin_password)

    admin_data = {
        "id": admin_email,
        "name": "System Administrator",
        "email": admin_email,
        "designation": "System Admin",
        "department": "Admin",
        "team": "System Admin",
        "empCode": "STC-ADMIN",
        "password_hash": hashed_password,
        "reviewer": "Management",
        "active": True,
        "profilePicture": None
    }

    team = admin_data["team"]
    collection_name = sanitize_team(team)
    collection = stc_db[collection_name]

    # Check if admin user already exists
    existing_user = await collection.find_one({"email": admin_email})

    if existing_user:
        # Update existing user's password
        await collection.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hashed_password}}
        )
        print(f"Admin user '{admin_email}' already exists. Password updated.")
    else:
        # Insert new admin user
        await collection.insert_one(admin_data)
        print(f"Admin user '{admin_email}' created successfully.")

if __name__ == "__main__":
    asyncio.run(create_admin_user())
