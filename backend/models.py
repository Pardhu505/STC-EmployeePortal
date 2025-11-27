import base64
import json
import logging
import re
import urllib.parse
import uuid
from datetime import datetime, timezone, timedelta, date, time
from typing import List, Dict, Union, Optional, Any

from bson import ObjectId
from fastapi import Header, HTTPException
from pydantic import BaseModel, Field, field_validator

from database import stc_db

ist_tz = timezone(timedelta(hours=5, minutes=30))

# --- Constants ---
TEAMS = [
    "Research", "Media", "Data", "Digital Production", "Digital Communication",
    "Propagation", "Neagitive Propagation", "Digital Marketing/Networking", "HIVE",
    "Campaign", "Soul Central", "Field Team AP-1", "Field Team AP-2", "Field Team TG",
    "PMU", "Directors Team-1", "Directors Team-2", "HR", "Directors Team-3",
    "Operations", "System Admin"
]

DEPARTMENT_TEAMS = {
    "Research": ["Research"], "Media": ["Media"], "Data": ["Data"],
    "DMC": ["Digital Production", "Digital Communication", "Propagation", "Neagitive Propagation", "Digital Marketing/Networking", "HIVE"],
    "Campaign": ["Campaign"],
    "Soul Central": ["Soul Central", "Field Team AP-1", "Field Team AP-2", "Field Team TG", "PMU"],
    "Directors team": ["Directors Team-1", "Directors Team-2", "Directors Team-3"],
    "HR": ["HR"], "Admin": ["Operations", "System Admin"]
}

# --- Helper Functions ---

def get_department_from_team(team: str) -> str:
    for dept, teams in DEPARTMENT_TEAMS.items():
        if team in teams:
            return dept
    return None

def serialize_document(obj):
    if isinstance(obj, dict):
        return {key: serialize_document(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [serialize_document(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        if obj.tzinfo is None:
            obj = obj.replace(tzinfo=timezone.utc)
        return obj.astimezone(ist_tz).isoformat()
    else:
        return obj

async def get_user_info_with_collection(stc_db, user_id: str, include_hash: bool = False) -> tuple[Optional[dict], Optional[any]]:
    all_collection_names = await stc_db.list_collection_names()
    team_collection_names = [name for name in all_collection_names if not name.startswith('system.')]
    projection = None if include_hash else {"password_hash": 0}
    decoded_user_id = urllib.parse.unquote(user_id)
    search_regex = re.compile(f"^{re.escape(decoded_user_id)}$", re.IGNORECASE)

    for collection_name in team_collection_names:
        try:
            collection = stc_db[collection_name]
            user = await collection.find_one({"email": search_regex}, projection)
            if user:
                return user, collection
        except Exception as e:
            logging.warning(f"Could not search in collection {collection_name}: {e}")
    return None, None

async def get_user_info(stc_db, user_id: str) -> Optional[dict]:
    user, _ = await get_user_info_with_collection(stc_db, user_id)
    return user

async def get_current_admin_user(authorization: Optional[str] = Header(None, alias="Authorization")):
    if not authorization:
        raise HTTPException(status_code=403, detail="Not an administrator")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token_str = authorization.split(" ")[1]
    try:
        decoded_token = base64.b64decode(token_str).decode('utf-8')
        user_data_from_token = json.loads(decoded_token)
        user_email_from_token = user_data_from_token.get("email")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token format.")

    if not user_email_from_token:
        raise HTTPException(status_code=401, detail="Invalid token: email missing.")

    user, _ = await get_user_info_with_collection(stc_db, user_email_from_token)
    if not user:
        raise HTTPException(status_code=401, detail="User not found or token is invalid")

    designation = user.get("designation", "").lower().strip()
    if user.get("isAdmin") or "admin" in designation or "director" in designation:
        return user

    raise HTTPException(status_code=403, detail="User is not an administrator")

# --- Pydantic Models ---

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    channel_id: Optional[str] = None
    recipient_id: Union[str, List[str], None] = None
    sender_id: str
    sender_name: str
    content: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(ist_tz))
    type: str = "text"
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    file_url: Optional[str] = None
    reactions: List[Dict[str, str]] = Field(default_factory=list)
    delivered_to: List[str] = Field(default_factory=list)
    read_by: List[str] = Field(default_factory=list)

class DeletedMessage(BaseModel):
    user_id: str
    message_id: str

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    sender_id: str
    sender_name: str
    message_id: str
    message_content: str
    channel_id: Optional[str] = None
    recipient_id: Optional[str] = None
    type: str = "message"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(ist_tz))
    is_read: bool = False

class Announcement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    priority: str
    author: str
    date: datetime = Field(default_factory=lambda: datetime.now(ist_tz))
    status: str = "published"
    scheduled_at: Optional[datetime] = None

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    priority: str
    scheduled_at: Optional[datetime] = None

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    priority: Optional[str] = None
    scheduled_at: Optional[datetime] = None

class Employee(BaseModel):
    id: str
    name: str
    email: str
    designation: str
    department: str
    team: str
    empCode: str
    password_hash: str
    reviewer: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    date_of_birth: Optional[str] = None
    last_online: Optional[datetime] = None
    profilePicture: Optional[str] = None
    active: bool = True

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    date_of_birth: Optional[Any] = None
    profilePicture: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zipcode: Optional[str] = None
    country: Optional[str] = None
    secondary_phone: Optional[str] = None
    class Config: extra = 'ignore'

class AdminUserUpdate(UserProfileUpdate):
    """Model for admin updates, extending the base user profile update."""
    designation: Optional[str] = None
    department: Optional[str] = None
    team: Optional[str] = None
    empCode: Optional[str] = None

class AdminPasswordReset(BaseModel):
    """Model for an admin resetting a user's password."""
    new_password: str

class LoginRequest(BaseModel):
    identifier: str
    password: str

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    team: str
    empCode: str
    designation: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    date_of_birth: Optional[str] = None
    profilePicture: Optional[str] = None
    department: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class MarkReadRequest(BaseModel):
    message_ids: List[str]
    chat_partner_id: Optional[str] = None
    channel_id: Optional[str] = None

class DailyRecord(BaseModel):
    date: datetime = Field(default_factory=lambda: datetime.now(ist_tz))
    status: str
    inTime: str
    outTime: str
    lateBy: str
    totalWorkingHours: str

    @field_validator('date', mode='before')
    @classmethod
    def validate_date(cls, v):
        if isinstance(v, str):
            v = datetime.fromisoformat(v)
        if isinstance(v, datetime):
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            v = datetime.combine(v.date(), time(0, 0, 0, tzinfo=timezone.utc))
        return v

class EmployeeAttendance(BaseModel):
    empCode: str
    empName: str
    dailyRecords: List[DailyRecord]

class ManagerReportRequest(BaseModel):
    manager_code: str
    team_emp_codes: List[str]
    reportType: str
    year: Optional[int] = None
    month: Optional[int] = None
    date: Optional[str] = None
    endDate: Optional[str] = None
delivered_to: List[str] = []
