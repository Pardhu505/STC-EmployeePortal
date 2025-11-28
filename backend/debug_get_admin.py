import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
import re

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Database Connection ---
attendance_mongo_url = os.environ.get("ATTENDANCE_MONGO_URL")
if not attendance_mongo_url:
    raise ValueError("ATTENDANCE_MONGO_URL not found in .env file")

attendance_client = AsyncIOMotorClient(attendance_mongo_url, tlsAllowInvalidCertificates=True)
stc_db = attendance_client['STC_Employees']

def sanitize_team(team: str) -> str:
    """Sanitize team name for MongoDB collection name."""
    sanitized = re.sub(r'[ /-]', '_', team)
    return sanitized

async def get_admin_user():
    """Fetches and prints the admin user from the database."""
    admin_email = "admin@showtimeconsulting.in"

    # We need to search all collections, just like the login function does.
    all_collection_names = await stc_db.list_collection_names()
    team_collection_names = [name for name in all_collection_names if not name.startswith('system.')]

    print(f"Searching for admin '{admin_email}' in collections: {team_collection_names}")

    found_user = None
    for collection_name in team_collection_names:
        collection = stc_db[collection_name]
        user = await collection.find_one({"email": admin_email})
        if user:
            print(f"\n--- Found admin user in collection: '{collection_name}' ---")
            # Convert ObjectId to string for printing
            if '_id' in user:
                user['_id'] = str(user['_id'])
            print(user)
            found_user = user
            break

    if not found_user:
        print(f"\n--- Admin user '{admin_email}' not found in any collection. ---")

if __name__ == "__main__":
    asyncio.run(get_admin_user())
