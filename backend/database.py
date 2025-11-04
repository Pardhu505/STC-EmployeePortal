import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from dotenv import load_dotenv
from pathlib import Path

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