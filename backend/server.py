from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Request, Body, File, UploadFile
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Dict, Union
import base64
import uuid
from datetime import datetime, timedelta, timezone, time, date
import json
import re
import asyncio
from bson.json_util import dumps
from typing import Optional, Any
# from mock_data_module import DEPARTMENT_DATA
import urllib.parse
import gsheets
from pydantic import field_validator
from passlib.context import CryptContext
from fastapi import Depends, Header
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .database import (
    main_db, attendance_db, chat_db, stc_db, grid_fs, get_grid_fs,
    main_client, attendance_client
)
from .download_file import router as download_router

from .sheets import get_data_from_sheet
import pandas as pd
import io

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# DeletedMessages
# Messages


# Define IST timezone
ist_tz = timezone(timedelta(hours=5, minutes=30))
# --- Allowed Origins for CORS ---
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://showtime-consulting-employee-portal.onrender.com",
    "https://showtime-employeeportal.vercel.app",
    "https://stc-employeeportal.vercel.app"
]

# --- Custom Exception Handlers to ensure CORS headers on errors ---

async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Custom handler for HTTPException to ensure all error responses include
    the necessary CORS headers. This prevents the frontend from seeing
    a generic "Network Error" on 4xx/5xx responses.
    """
    origin = request.headers.get('origin')
    headers = getattr(exc, "headers", None) or {}
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"

    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers,
    )

async def generic_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler for unhandled exceptions to return a 500 error
    with CORS headers.
    """
    logging.error(f"Unhandled exception: {exc}", exc_info=True)
    origin = request.headers.get('origin')
    headers = {}
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"

    return JSONResponse(status_code=500, content={"detail": "An internal server error occurred."}, headers=headers)

# Create the main app and register exception handlers
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the custom exception handlers
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# --- Constants for Teams and Departments ---
# Moved these definitions to the top to resolve NameError issues in methods
# that depend on them, like get_channel_members.

TEAMS = [
    "Research",
    "Media",
    "Data",
    "Digital Production",
    "Digital Communication",
    "Propagation",
    "Neagitive Propagation",
    "Digital Marketing/Networking",
    "HIVE",
    "Campaign",
    "Soul Central",
    "Field Team AP-1",
    "Field Team AP-2",
    "Field Team TG",
    "PMU",
    "Directors Team-1",
    "Directors Team-2",
    "HR",
    "Directors Team-3",
    "Operations",
    "System Admin"
]

DEPARTMENT_TEAMS = {
    "Research": ["Research"],
    "Media": ["Media"],
    "Data": ["Data"],
    "DMC": [
        "Digital Production",
        "Digital Communication",
        "Propagation",
        "Neagitive Propagation",
        "Digital Marketing/Networking",
        "HIVE"
    ],
    "Campaign": ["Campaign"],
    "Soul Central": [
        "Soul Central",
        "Field Team AP-1",
        "Field Team AP-2",
        "Field Team TG",
        "PMU"
    ],
    "Directors team": [
        "Directors Team-1",
        "Directors Team-2",
        "Directors Team-3"
    ],
    "HR": ["HR"],
    "Admin": [
        "Operations",
        "System Admin"
    ]
}

def get_department_from_team(team: str) -> str:
    """
    Helper function to find the department for a given team.
    This needs DEPARTMENT_TEAMS to be defined before it's called.
    """
    for dept, teams in DEPARTMENT_TEAMS.items():
        if team in teams:
            return dept
    return None


# --- Dependencies ---


async def get_current_admin_user(authorization: Optional[str] = Header(None, alias="Authorization")):
    """
    Dependency to get and validate the current admin user from a token.
    This checks if the user associated with the token is an admin.
    If no token is provided, it returns None. If a token is provided but invalid, it raises an error.
    """
    if not authorization:
        return None # No token provided, this is not an error for optional auth.

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token_str = authorization.split(" ")[1]
    logging.info(f"Admin auth attempt with token: {token_str[:100]}...") # Log token safely

    user_email_from_token = None
    try:
        # The token is a Base64-encoded JSON string of the user object.
        # First, decode from Base64, then parse the JSON.
        decoded_token = base64.b64decode(token_str).decode('utf-8')
        user_data_from_token = json.loads(decoded_token)
        user_email_from_token = user_data_from_token.get("email") if isinstance(user_data_from_token, dict) else None
    except (json.JSONDecodeError, base64.binascii.Error, AttributeError, TypeError) as e:
        logging.warning(f"Admin auth failed: Could not decode or parse token. Error: {e}. Token: {token_str[:100]}...")
        raise HTTPException(status_code=401, detail="Invalid token format.")

    if not user_email_from_token:
        logging.warning("Admin auth failed: Could not extract email from token.")
        raise HTTPException(status_code=401, detail="Invalid token: email missing.")

    user, _ = await get_user_info_with_collection(stc_db, user_email_from_token)

    if not user:
        logging.warning(f"Admin auth failed: User '{user_email_from_token}' not found in database")
        raise HTTPException(status_code=401, detail="User not found or token is invalid")

    # Check if the user exists and has an admin designation.
    # Also check the 'isAdmin' flag for robustness.
    designation = user.get("designation", "").lower().strip()
    if user.get("isAdmin") or "admin" in designation or "director" in designation:
        logging.info(f"Admin access granted for user: {user_email_from_token}")
        return user

    raise HTTPException(status_code=403, detail="User is not an administrator")


# --- Admin Routes ---

class AdminUserUpdate(BaseModel):
    """
    Pydantic model for admin updates. All fields are optional.
    """
    name: Optional[str] = None
    email: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    team: Optional[str] = None
    empCode: Optional[str] = None

    class Config:
        extra = 'ignore'

class AdminPasswordReset(BaseModel):
    new_password: str

@api_router.put("/admin/users/{original_email}/details")
async def admin_update_user_details(
    original_email: str, 
    user_data: AdminUserUpdate, 
    admin_user: dict = Depends(get_current_admin_user)
):
    """
    Admin endpoint to update a user's details.
    """
    decoded_email = urllib.parse.unquote(original_email)
    user, collection = await get_user_info_with_collection(stc_db, decoded_email)

    if not user or collection is None:
        raise HTTPException(status_code=404, detail="User not found")

    update_payload = user_data.model_dump(exclude_unset=True)

    if not update_payload:
        raise HTTPException(status_code=400, detail="No update data provided.")

    # If the email is being changed, we need to handle it carefully
    new_email = update_payload.get("email")
    if new_email and new_email.lower() != decoded_email.lower():
        # Check if the new email is already taken
        existing_user, _ = await get_user_info_with_collection(stc_db, new_email)
        if existing_user:
            raise HTTPException(status_code=400, detail="New email is already in use.")
        # Update the 'id' field as well if it's based on email
        update_payload['id'] = new_email

    await collection.update_one(
        {"email": re.compile(f"^{re.escape(decoded_email)}$", re.IGNORECASE)},
        {"$set": update_payload}
    )

    logging.info(f"Admin '{admin_user.get('email')}' updated details for user '{decoded_email}'.")
    return {"message": f"User {decoded_email} updated successfully."}

@api_router.delete("/admin/users/{email}")
async def admin_delete_user(email: str, admin_user: dict = Depends(get_current_admin_user)):
    """
    Admin endpoint to permanently delete a user.
    """
    decoded_email = urllib.parse.unquote(email)
    user, collection = await get_user_info_with_collection(stc_db, decoded_email)

    if not user or collection is None:
        raise HTTPException(status_code=404, detail="User not found")

    result = await collection.delete_one({"email": re.compile(f"^{re.escape(decoded_email)}$", re.IGNORECASE)})

    if result.deleted_count > 0:
        logging.info(f"Admin '{admin_user.get('email')}' permanently deleted user '{decoded_email}'.")
        return {"message": f"User {decoded_email} has been permanently deleted."}
    
    raise HTTPException(status_code=500, detail="Failed to delete user.")

@api_router.post("/admin/users/{email}/reset-password")
async def admin_reset_password(
    email: str, 
    password_data: AdminPasswordReset, 
    admin_user: dict = Depends(get_current_admin_user)
):
    """
    Admin endpoint to reset a user's password.
    """
    decoded_email = urllib.parse.unquote(email)
    # We pass an empty current_password because the check will be bypassed by is_admin_reset=True
    # The admin_user dependency ensures this is an authorized action.
    response = await change_password(
        user_id=decoded_email,
        request=PasswordChangeRequest(current_password="", new_password=password_data.new_password),
        admin_user=admin_user
    )
    return response

# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        # Change active_connections to map user_id to a set of WebSocket connections
        self.active_connections: Dict[str, set[WebSocket]] = {}
        self.user_status: Dict[str, str] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        self.user_status[user_id] = "online"
        logging.info(f"User {user_id} connected. Total connections for user: {len(self.active_connections[user_id])}")
        await self.broadcast_status(user_id, "online")
        
        # Send missed messages and notifications BEFORE updating the last_online timestamp.
        await self.send_missed_messages(user_id, stc_db, chat_db)

        try:
            now = datetime.now(ist_tz)
            user, collection = await get_user_info_with_collection(stc_db, user_id)
            if user and collection is not None:
                await collection.update_one(
                    {"$or": [{"id": user_id}, {"email": user_id}]},
                    {"$set": {"last_online": now}}
                )
                logging.info(f"Updated last_online for user {user_id} to {now}")
            else:
                logging.warning(f"User {user_id} not found for last_online update")
        except Exception as e:
            logging.error(f"Failed to update last_online for user {user_id}: {e}")

        # Now, send any other pending notifications (like for announcements)
        await self.send_pending_notifications(user_id, chat_db)

    async def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                self.user_status[user_id] = "offline"
                logging.info(f"User {user_id} disconnected. No more active connections.")
                # Broadcast offline status only when the last connection is gone
                await self.broadcast_status(user_id, "offline")
            else:
                logging.info(f"User {user_id} disconnected one connection. Remaining connections: {len(self.active_connections.get(user_id, []))}")

    async def send_personal_message(self, message: str, user_id: str):
        """
        Send a personal message to a user if connected.
        If the user is offline, create a notification for later delivery.
        """
        if user_id in self.active_connections:
            logging.info(f"Sending personal message to {user_id}: {message[:200]}...")
            for connection in self.active_connections[user_id]:
                await connection.send_text(message)
        else:
            logging.info(f"User {user_id} is offline. Creating notification for later delivery.")
            # Create notification for offline user
            await self.create_notification_from_message(message, user_id, chat_db)

    async def send_missed_messages(self, user_id: str, stc_db, chat_db):
        """Query and send missed messages since last_online to the user"""
        try:
            user = await get_user_info(stc_db, user_id)
            if not user:
                logging.warning(f"User {user_id} not found for missed messages")
                return
            last_online = user.get("last_online")
            if not last_online:
                # For new users or users without last_online, send messages from the last 7 days
                last_online = datetime.now(ist_tz) - timedelta(days=7)
                logging.info(f"No last_online timestamp for user {user_id}, using {last_online} for missed messages")

            # Query direct messages where recipient is user and timestamp > last_online
            direct_messages_pipeline = [
                {"$match": {
                    "$and": [
                        {"recipient_id": user_id},
                        {"sender_id": {"$ne": user_id}},
                        {"timestamp": {"$gt": last_online}}
                    ]
                }},
                {"$sort": {"timestamp": 1}}
            ]
            direct_messages = await chat_db.Direct_chat.aggregate(direct_messages_pipeline).to_list(length=None)

            # Query channel messages for channels user is member of, timestamp > last_online
            # Get channels user is member of
            channels = await self.get_user_channels(user_id, stc_db)
            channel_messages = []
            for channel_id in channels:
                pipeline = [
                    {"$match": {
                        "$and": [
                            {"channel_id": channel_id},
                            {"sender_id": {"$ne": user_id}},
                            {"timestamp": {"$gt": last_online}}
                        ]
                    }},
                    {"$sort": {"timestamp": 1}}
                ]
                msgs = await chat_db.Channel_chat.aggregate(pipeline).to_list(length=None)
                channel_messages.extend(msgs)

            # Combine messages
            missed_messages = direct_messages + channel_messages
            missed_messages.sort(key=lambda m: m["timestamp"])

            if missed_messages:
                missed_messages_json = json.dumps({
                    "type": "missed_messages",
                    "messages": serialize_document(missed_messages)
                })
                if user_id in self.active_connections:
                    for connection in self.active_connections[user_id]:
                        await connection.send_text(missed_messages_json)
                logging.info(f"Sent {len(missed_messages)} missed messages to user {user_id}")
            else:
                logging.info(f"No missed messages for user {user_id}")

        except Exception as e:
            logging.error(f"Failed to send missed messages to user {user_id}: {e}")

    async def get_user_channels(self, user_id: str, stc_db) -> List[str]:
        """Get list of channel IDs the user is a member of"""
        channels = ["general"]
        try:
            user = await get_user_info(stc_db, user_id)
            if user and user.get("team"):
                dept = get_department_from_team(user["team"])
                if dept:
                    dept_slug = dept.lower().replace(' ', '-').replace('/', '-')
                    channels.append(f"dept-{dept_slug}")
                # Add team channel
                team_slug = user["team"].lower().replace(' ', '-').replace('/', '-')
                channels.append(f"team-{team_slug}")
        except Exception as e:
            logging.error(f"Failed to get channels for user {user_id}: {e}")
        return channels

    async def create_notification_from_message(self, message_json: str, user_id: str, db):
        """Create a notification from a message JSON string for an offline user"""
        try:
            message_data = json.loads(message_json)
            notification = Notification(
                user_id=user_id,
                sender_id=message_data.get("sender_id", ""),
                sender_name=message_data.get("sender_name", ""),
                message_id=message_data.get("id", ""),
                message_content=message_data.get("content", "")[:100],  # Truncate content for preview
                channel_id=message_data.get("channel_id"),
                recipient_id=message_data.get("recipient_id"),
                type="channel_message" if message_data.get("channel_id") else "direct_message",
                timestamp=datetime.now(ist_tz),
                is_read=False
            )
            await db.Notifications.insert_one(notification.model_dump())
            logging.info(f"Notification created for offline user {user_id}")
        except Exception as e:
            logging.error(f"Failed to create notification for user {user_id}: {e}")

    async def send_pending_notifications(self, user_id: str, db):
        """Send all unread notifications to a user when they connect"""
        try:
            notifications = await db.Notifications.find(
                {"user_id": user_id, "is_read": False},
                {"_id": 0}
            ).sort("timestamp", 1).to_list(length=None)

            if notifications:
                for notification in notifications:
                    def default_serializer(o):
                        if isinstance(o, (datetime, date)):
                            return o.isoformat()
                        raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")
                    notification_json = json.dumps({
                        "type": "notification",
                        "notification": notification
                    }, default=default_serializer)

                    if user_id in self.active_connections:
                        for connection in self.active_connections[user_id]:
                            await connection.send_text(notification_json)

                # Mark notifications as read after sending
                await db.Notifications.update_many(
                    {"user_id": user_id, "is_read": False},
                    {"$set": {"is_read": True}}
                )
                logging.info(f"Sent {len(notifications)} pending notifications to {user_id}")
        except Exception as e:
            logging.error(f"Failed to send pending notifications to {user_id}: {e}")

    async def create_channel_notifications(self, message_json: str, channel_id: str, sender_id: str, stc_db, chat_db):
        """Create notifications for offline channel members"""
        try:
            channel_members = await self.get_channel_members(channel_id, stc_db)
            message_data = json.loads(message_json)

            for member_id in channel_members:
                if member_id != sender_id and member_id not in self.active_connections:
                    notification = Notification(
                        user_id=member_id,
                        sender_id=message_data.get("sender_id", ""),
                        sender_name=message_data.get("sender_name", ""),
                        message_id=message_data.get("id", ""),
                        message_content=message_data.get("content", "")[:100],
                        channel_id=channel_id,
                        type="channel_message",
                        timestamp=datetime.now(ist_tz),
                        is_read=False
                    )
                    await chat_db.Notifications.insert_one(notification.model_dump())
                    logging.info(f"Channel notification created for offline user {member_id} in channel {channel_id}")
        except Exception as e:
            logging.error(f"Failed to create channel notifications: {e}")

    async def broadcast(self, message: str, sender_id: str = None):
        logging.info(f"Broadcasting message from {sender_id}: {message}")
        for user_id, connections in self.active_connections.items():
            if sender_id and user_id == sender_id:
                continue
            for connection in connections:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logging.warning(f"Failed to send message to {user_id} (connection may be closed): {e}")

    async def broadcast_status(self, user_id: str, status: str):
        self.user_status[user_id] = status
        message = json.dumps({"type": "status_update", "user_id": user_id, "status": status})
        logging.info(f"Broadcasting status update: {message}")
        for connection_user_id, connections in self.active_connections.items():
            for connection in connections:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logging.warning(f"Failed to broadcast status to {connection_user_id} (connection may be closed): {e}")

    async def get_channel_members(self, channel_id: str, stc_db) -> List[str]:
        """Get list of user emails (user_ids) who are members of the channel"""
        if channel_id == 'general':
            # All employees
            members = await get_all_employees_emails(stc_db)
            return members
        elif channel_id.startswith('dept-'):
            # Department channel, e.g., 'dept-data'
            dept_name_raw = channel_id.replace('dept-', '').replace('-', ' ')
            # Find the original department name from DEPARTMENT_TEAMS keys
            # This is more reliable than trying to reconstruct it.
            dept_name_found = None
            for dept in DEPARTMENT_TEAMS.keys():
                if dept.lower().replace(' ', '-') == dept_name_raw:
                    dept_name_found = dept
                    break
            
            members = await get_employees_by_department(stc_db, dept_name_found) if dept_name_found else []
            return members
        elif channel_id.startswith('team-'):
            # Team channel, e.g., 'team-research'
            team_slug = channel_id.replace('team-', '')
            team_name = None
            for team in TEAMS:
                if team.lower().replace(' ', '-').replace('/', '-') == team_slug:
                    team_name = team
                    break
            if team_name:
                collection = stc_db[sanitize_team(team_name)]
                users = await collection.find({}, {"email": 1, "_id": 0}).to_list(None)
                members = [u['email'] for u in users]
                return members
            else:
                logging.warning(f"Unknown team slug: {team_slug}")
                return []
        else:
            # For sub-department or unknown, return empty (can extend if needed)
            logging.warning(f"Unknown channel_id: {channel_id}")
            return []

    async def broadcast_to_channel(self, message: str, channel_id: str, stc_db, sender_id: str = None):
        """Broadcast message to all members of the channel who are connected"""
        channel_members = await self.get_channel_members(channel_id, stc_db)
        for user_id in channel_members:
            if sender_id and user_id == sender_id:
                continue  # Don't send the message back to the sender
            if user_id in self.active_connections:
                for connection in self.active_connections[user_id]:
                    try:
                        await connection.send_text(message)
                    except Exception as e:
                        logging.warning(f"Failed to send message to {user_id} on connection {connection} (may be closed): {e}")

manager = ConnectionManager()

# --- Models ---
class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    channel_id: str | None = None
    recipient_id: Union[str, List[str], None] = None
    sender_id: str
    sender_name: str
    content: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(ist_tz))
    type: str = "text"
    # Added fields for file messages
    file_name: str | None = None
    file_type: str | None = None
    file_size: int | None = None
    file_url: str | None = None
    # Added field for reactions
    reactions: List[Dict[str, str]] = Field(default_factory=list)

class DeletedMessage(BaseModel):
    user_id: str
    message_id: str

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # The user who should receive the notification
    sender_id: str  # The user who sent the message
    sender_name: str
    message_id: str  # Reference to the original message
    message_content: str  # Preview of the message content
    channel_id: str | None = None
    recipient_id: str | None = None
    type: str = "message"  # "message", "channel_message", etc.
    timestamp: datetime = Field(default_factory=lambda: datetime.now(ist_tz))
    is_read: bool = False

class Announcement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    priority: str
    author: str
    date: datetime = Field(default_factory=lambda: datetime.now(ist_tz))

    # New fields for scheduling
    status: str = "published" # Can be 'published' or 'scheduled'
    scheduled_at: Optional[datetime] = None

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    priority: str
class Employee(BaseModel):
    id: str
    name: str
    email: str
    designation: str
    department: str
    team: str
    empCode: str
    password_hash: str
    reviewer: str | None = None
    phone: str | None = None
    emergency_contact: str | None = None
    date_of_birth: str | None = None
    last_online: datetime | None = None
    profilePicture: str | None = None
    active: bool = True

class EmployeeCreate(BaseModel):
    scheduled_at: Optional[datetime] = None
    """Model for creating a new employee, without database-generated fields."""
    id: str
    name: str
    email: str
    designation: str
    department: str
    team: str
    empCode: str
    password_hash: str
    reviewer: str | None = None
    phone: str | None = None
    emergency_contact: str | None = None
    date_of_birth: datetime | None = None
    profilePicture: str | None = None


class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(ist_tz))
    status: str

class StatusCheckCreate(BaseModel):
    client_name: str
    status: str
    
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
        # Handle string input from the frontend CSV parser
        if isinstance(v, str):
            try:
                # The frontend sends a string like 'YYYY-MM-DDTHH:MM:SS'
                v = datetime.fromisoformat(v)
            except ValueError:
                raise ValueError(f"Invalid date format: {v}")

        if isinstance(v, datetime):
            if v.tzinfo is None:
                # Assume UTC if no timezone is provided, as from the frontend
                v = v.replace(tzinfo=timezone.utc)
            # Normalize to just the date part at midnight UTC
            v = datetime.combine(v.date(), time(0, 0, 0, tzinfo=timezone.utc))
        return v

class EmployeeAttendance(BaseModel):
    empCode: str
    empName: str
    dailyRecords: List[DailyRecord]
class EmployeeData(BaseModel):
    empCode: str
    empName: str
    dailyRecords: List[DailyRecord]

class AttendanceReportData(BaseModel):
    employees: Dict[str, EmployeeData]

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(ist_tz))


async def get_user_info(stc_db, user_id: str) -> Optional[dict]:
    """
    Get user info by id or email. This function is less efficient as it scans all collections.
    Prefer get_user_info_with_collection where possible.
    """
    user, _ = await get_user_info_with_collection(stc_db, user_id)
    return user


async def get_user_info_with_collection(stc_db, user_id: str, include_hash: bool = False) -> tuple[Optional[dict], Optional[any]]:
    """
    Get user info and their collection by id or email with a case-insensitive search.
    This function is now more robust and searches across all defined team collections.
    """
    # Fetch all non-system collections directly from the database for robustness.
    all_collection_names = await stc_db.list_collection_names()
    team_collection_names = [name for name in all_collection_names if not name.startswith('system.')]

    projection = None if include_hash else {"password_hash": 0}
    
    # Use a case-insensitive regex for both id and email search
    # The user_id might be URL-encoded, so decode it first.
    decoded_user_id = urllib.parse.unquote(user_id)
    search_regex = re.compile(f"^{re.escape(decoded_user_id)}$", re.IGNORECASE)

    for collection_name in team_collection_names:
        try:
            collection = stc_db[collection_name]
            # Search by 'email' field case-insensitively
            user = await collection.find_one({"email": search_regex}, projection)

            if user:
                return user, collection
        except Exception as e:
            logging.warning(f"Could not search in collection {collection_name}: {e}")
    return None, None


async def get_all_employees_emails(stc_db) -> List[str]:
    """Get all unique employee emails from stc_db."""
    collection_names = await stc_db.list_collection_names()
    team_collections = [stc_db[name] for name in collection_names]
    all_emails = set()
    for collection in team_collections:
        users = await collection.find({}, {"email": 1, "_id": 0}).to_list(None)
        for u in users:
            all_emails.add(u['email'])
    return list(all_emails)


async def get_employees_by_department(stc_db, dept_name: str) -> List[str]:
    """Get emails of employees in a specific department from stc_db."""
    all_emails = set()
    collection_names = await stc_db.list_collection_names()
    team_collections = [stc_db[name] for name in collection_names]
    for collection in team_collections:
        # Use case-insensitive regex for matching department
        users = await collection.find({"department": re.compile(f"^{re.escape(dept_name)}$", re.IGNORECASE)}, {"email": 1, "_id": 0}).to_list(None)
        for u in users:
            all_emails.add(u['email'])
    return list(all_emails)

def sanitize_team(team: str) -> str:
    """Sanitize team name for MongoDB collection name."""
    sanitized = re.sub(r'[ /-]', '_', team)
    # Remove any other invalid chars if needed, but keep alphanumeric and _
    return sanitized

class UserProfileUpdate(BaseModel):
    """
    Pydantic model for validating incoming user profile update data.
    All fields are optional, allowing partial updates.
    """
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    date_of_birth: Optional[Any] = None # Using Any to be flexible with date string formats
    profilePicture: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zipcode: Optional[str] = None
    country: Optional[str] = None
    secondary_phone: Optional[str] = None

    class Config:
        extra = 'ignore' # Ignore any extra fields sent by the client

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
    # New optional fields for signup
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    date_of_birth: Optional[str] = None
    profilePicture: Optional[str] = None
    department: Optional[str] = None

# --- Helper Functions ---
def serialize_document(obj):
    """Recursively convert ObjectId and datetime fields to strings in a document for JSON serialization."""
    if isinstance(obj, dict):
        return {key: serialize_document(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [serialize_document(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        # If the datetime is naive, assume it's UTC and make it aware
        if obj.tzinfo is None:
            obj = obj.replace(tzinfo=timezone.utc)
        # Convert to IST and then to ISO format string
        return obj.astimezone(ist_tz).isoformat()
    else:
        return obj

# --- API Routes ---
@api_router.get("/health")
async def health_check():
    return {"status": "ok"}

class SheetRequest(BaseModel):
    url: str
    sheet_name: Optional[Union[str, int]] = None

@api_router.post("/sheets/data")
async def get_sheet_data(request: SheetRequest):
    """
    Fetches data from a Google Sheet.
    The service account key should be set as GOOGLE_SHEETS_CREDENTIALS environment variable.
    """
    try:
        data = get_data_from_sheet(request.url, request.sheet_name)
        return data
    except Exception as e:
        logging.error(f"Failed to fetch sheet data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch sheet data: {e}")

@api_router.get("/")
async def root():
    return {"message": "Hello World from API"}

@api_router.get("/users/status", response_model=List[Dict])
async def get_all_user_statuses():
    try:
        all_employee_emails = await get_all_employees_emails(stc_db)
        statuses = []
        for user_id in all_employee_emails:
            # Default to offline
            current_status = "offline"

            # Check real-time status from the ConnectionManager
            if user_id in manager.user_status:
                current_status = manager.user_status[user_id]

            # An active connection overrides status to 'online' unless 'busy'
            if user_id in manager.active_connections and current_status != "busy":
                current_status = "online"
            
            statuses.append({"user_id": user_id, "status": current_status})
        return statuses
    except Exception as e:
        logging.error(f"Error fetching all user statuses: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch user statuses")

@api_router.post("/users/{user_id}/status", response_model=Dict)
async def set_user_status_api(user_id: str, status_update: StatusCheckCreate):
    if status_update.client_name != user_id:
        raise HTTPException(status_code=400, detail="User ID in path and body must match.")

    new_status = status_update.status.lower()
    if new_status not in ["online", "offline", "busy"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'online', 'offline', or 'busy'.")

    manager.user_status[user_id] = new_status
    await manager.broadcast_status(user_id, new_status)
    return {"user_id": user_id, "status": new_status}

class UserPasswordResetRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.put("/users/me/reset-password")
async def user_reset_password(
    request: UserPasswordResetRequest = Body(...),
    authorization: str = Header(..., alias="Authorization")
):
    """
    Allows a logged-in user to reset their own password securely.
    Requires the current password for verification.
    """
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Not authenticated")

        token_str = authorization.split(" ")[1]
        decoded_token = base64.b64decode(token_str).decode('utf-8')
        user_data = json.loads(decoded_token)
        user_email = user_data.get("email")

        if not user_email:
            raise HTTPException(status_code=400, detail="Invalid token: no email found")

        # Fetch user with password_hash
        user, collection = await get_user_info_with_collection(stc_db, user_email, include_hash=True)
        if not user or collection is None:
            raise HTTPException(status_code=404, detail="User not found")

        stored_hash = user.get("password_hash")
        if not pwd_context.verify(request.current_password, stored_hash):
            raise HTTPException(status_code=403, detail="Current password is incorrect")

        # Update new password
        new_hash = pwd_context.hash(request.new_password)
        await collection.update_one(
            {"email": re.compile(f"^{re.escape(user_email)}$", re.IGNORECASE)},
            {"$set": {"password_hash": new_hash}}
        )

        return {"message": "Password reset successful"}

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error resetting password: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during password reset")
    
@api_router.get("/messages")
async def get_messages(channel_id: str = None, recipient_id: str = None, sender_id: str = None, user_id: str = None, limit: int = 50):
    query = {}
    collection = None
    if channel_id:
        if user_id:
            # Check if user is member of the channel
            channels = await manager.get_user_channels(user_id, stc_db)
            if channel_id not in channels:
                raise HTTPException(status_code=403, detail="Unauthorized to view this channel")
        query["channel_id"] = channel_id
        collection = chat_db.Channel_chat
    elif recipient_id:
        if recipient_id == 'general' or recipient_id.startswith('dept-') or recipient_id.startswith('team-'):
            # Channel messages
            if user_id:
                # Check if user is member of the channel
                channels = await manager.get_user_channels(user_id, stc_db)
                if recipient_id not in channels:
                    raise HTTPException(status_code=403, detail="Unauthorized to view this channel")
            query["channel_id"] = recipient_id
            collection = chat_db.Channel_chat
        elif sender_id:
            # Direct messages: conversation between sender and recipient
            if user_id and user_id not in [sender_id, recipient_id]:
                raise HTTPException(status_code=403, detail="Unauthorized to view this conversation")
            query = {
                "$or": [
                    {"sender_id": sender_id, "recipient_id": {"$in": [recipient_id]}},
                    {"sender_id": recipient_id, "recipient_id": {"$in": [sender_id]}}
                ]
            }
            collection = chat_db.Direct_chat
        else:
            # Messages to the recipient (could be direct or group)
            if user_id and user_id != recipient_id:
                raise HTTPException(status_code=403, detail="Unauthorized to view this conversation")
            query = {"recipient_id": {"$in": [recipient_id]}}
            collection = chat_db.Direct_chat  # Assuming group messages are in Direct_chat, adjust if needed

    if collection is None:
        collection = chat_db.Channel_chat  # Default to channel chat

    if user_id:
        # Use aggregation to exclude deleted messages for the user
        pipeline = [
            {"$match": query},
            {"$lookup": {
                "from": "DeletedMessages",
                "let": {"message_id": "$id"},
                "pipeline": [
                    {"$match": {
                        "$and": [
                            {"message_id": "$$message_id"},
                            {"user_id": user_id}
                        ]
                    }}
                ],
                "as": "deleted"
            }},
            {"$match": {"deleted": {"$size": 0}}},
            {"$sort": {"timestamp": -1}},
            {"$limit": limit},
            {"$sort": {"timestamp": 1}}
        ]
        messages = await collection.aggregate(pipeline).to_list(length=None)
    else:
        messages = await collection.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(length=limit)
        messages.reverse()

    # Ensure all messages have a timestamp and convert to IST
    for msg in messages:
        if not msg.get('timestamp'):
            msg['timestamp'] = datetime.now(ist_tz).isoformat()
        else:
            # Convert existing timestamp to IST
            ts=msg['timestamp']
            if ts.tzinfo is None:
              ts = ts.replace(tzinfo=timezone.utc)
            msg['timestamp'] = ts.astimezone(ist_tz).isoformat()
    # Convert ObjectId to string for JSON serialization
    messages = serialize_document(messages)
    return messages

@api_router.get("/channel-messages")
async def get_channel_messages(channel_id: str, user_id: str = None, limit: int = 50):
    """Get messages for a specific channel"""
    if user_id:
        # Check if user is member of the channel
        channels = await manager.get_user_channels(user_id, stc_db)
        if channel_id not in channels:
            raise HTTPException(status_code=403, detail="Unauthorized to view this channel")
    query = {"channel_id": channel_id}

    if user_id:
        try:
            # Get list of deleted message IDs for this user
            deleted_messages = await chat_db.DeletedMessages.find(
                {"user_id": user_id},
                {"message_id": 1, "_id": 0}
            ).to_list(length=None)
            deleted_message_ids = {msg["message_id"] for msg in deleted_messages}

            # Get all messages first
            all_messages = await chat_db.Channel_chat.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(length=limit)
            all_messages.reverse()

            # Filter out deleted messages
            messages = [msg for msg in all_messages if msg.get("id") not in deleted_message_ids]
        except Exception as e:
            logging.error(f"Error filtering deleted messages for user {user_id} in channel {channel_id}: {e}")
            # If there's an error, return all messages rather than failing completely
            messages = await chat_db.Channel_chat.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(length=limit)
            messages.reverse()
    else:
        messages = await chat_db.Channel_chat.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(length=limit)
        messages.reverse()

    # Ensure all messages have a timestamp and convert to IST
    for msg in messages:
        if not msg.get('timestamp'):
            msg['timestamp'] = datetime.now(ist_tz).isoformat()
        else:
            ts = msg['timestamp']
            if ts.tzinfo is None:
               ts = ts.replace(tzinfo=timezone.utc)
            msg['timestamp'] = ts.astimezone(ist_tz).isoformat()
    # Convert ObjectId to string for JSON serialization
    messages = serialize_document(messages)
    return messages

@api_router.get("/direct-messages")
async def get_direct_messages(sender_id: str, recipient_id: str, user_id: str = None, limit: int = 50):
    """Get direct messages between two users"""
    if user_id and user_id not in [sender_id, recipient_id]:
        raise HTTPException(status_code=403, detail="Unauthorized to view this conversation")
    query = {
        "$or": [
            {"sender_id": sender_id, "recipient_id": recipient_id},
            {"sender_id": recipient_id, "recipient_id": sender_id}
        ]
    }

    # Get all messages first
    messages = await chat_db.Direct_chat.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(length=limit)
    messages.reverse()

    # If user_id is provided, filter out deleted messages for this user
    if user_id:
        try:
            # Get list of deleted message IDs for this user
            deleted_messages = await chat_db.DeletedMessages.find(
                {"user_id": user_id},
                {"message_id": 1, "_id": 0}
            ).to_list(length=None)
            deleted_message_ids = {msg["message_id"] for msg in deleted_messages}

            # Filter out deleted messages
            messages = [msg for msg in messages if msg.get("id") not in deleted_message_ids]
        except Exception as e:
            logging.error(f"Error filtering deleted messages for user {user_id}: {e}")
            # If there's an error, return all messages rather than failing completely
            pass
    # Ensure all messages have a timestamp and convert to IST
    for msg in messages:
        if not msg.get('timestamp'):
            msg['timestamp'] = datetime.now(ist_tz).isoformat()
        else:
            ts = msg['timestamp']
            if ts.tzinfo is None:
               ts = ts.replace(tzinfo=timezone.utc)
            msg['timestamp'] = ts.astimezone(ist_tz).isoformat()
    # Convert ObjectId to string for JSON serialization
    # Convert ObjectId to string for JSON serialization
    messages = serialize_document(messages)
    return messages

@api_router.delete("/messages")
async def delete_all_messages():
    """Permanently delete all messages from chat history"""
    try:
        result_channel = await chat_db.Channel_chat.delete_many({})
        result_direct = await chat_db.Direct_chat.delete_many({})
        total_deleted = result_channel.deleted_count + result_direct.deleted_count
        return {"message": f"Deleted {total_deleted} messages successfully"}
    except Exception as e:
        logging.error(f"Error deleting all messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete messages")


from fastapi import Query
from datetime import datetime

# ---------------------------
# CLEAR CHAT (Direct & Channel)
# ---------------------------

@api_router.post("/direct-messages/clear-for-user")
async def clear_direct_messages_for_user(
    sender_id: str = Query(...),
    recipient_id: str = Query(...),
    user_id: str = Query(...)
):
    """
    Soft-clear all direct messages between two users for the requesting user
    by inserting into DeletedMessages.
    """
    try:
        msgs = await chat_db.Direct_chat.find({
            "$or": [
                {"sender_id": sender_id, "recipient_id": recipient_id},
                {"sender_id": recipient_id, "recipient_id": sender_id}
            ]
        }, {"id": 1}).to_list(length=None)

        if msgs:
            to_insert = [{"user_id": user_id, "message_id": msg["id"], "created_at": datetime.now(ist_tz)} for msg in msgs]
            if to_insert:
                await chat_db.DeletedMessages.insert_many(to_insert)
        return {"message": "Direct chat cleared for user"}
    except Exception as e:
        logging.error(f"Error clearing direct chat for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear direct chat")


@api_router.post("/channel-messages/clear-for-user")
async def clear_channel_messages_for_user(
    channel_id: str = Query(...),
    user_id: str = Query(...)
):
    """
    Soft-clear all channel messages for a user by marking them in DeletedMessages.
    """
    try:
        msgs = await chat_db.Channel_chat.find({"channel_id": channel_id}, {"id": 1}).to_list(length=None)

        if msgs:
            to_insert = [{"user_id": user_id, "message_id": msg["id"], "created_at": datetime.now(ist_tz)} for msg in msgs]
            if to_insert:
                await chat_db.DeletedMessages.insert_many(to_insert)
        return {"message": "Channel chat cleared for user"}
    except Exception as e:
        logging.error(f"Error clearing channel {channel_id} for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear channel chat")


# ---------------------------
# DELETE FOR ME
# ---------------------------


@api_router.post("/messages/{message_id}/delete")
async def mark_message_deleted_for_user(
    message_id: str,
    user_id: str = Query(...)
):
    """
    Mark a message as deleted only for the requesting user.
    """
    try:
        deleted_message = DeletedMessage(user_id=user_id, message_id=message_id, created_at=datetime.now(ist_tz))
        await chat_db.DeletedMessages.insert_one(deleted_message.model_dump())

        # Optionally notify just this user
        hidden_json = json.dumps({
            "type": "message_hidden",
            "message_id": message_id,
            "user_id": user_id
        })
        await manager.send_personal_message(hidden_json, user_id)

        return {"message": "Message marked as deleted for user"}
    except Exception as e:
        logging.error(f"Error marking message {message_id} as deleted for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to mark message as deleted")


# ---------------------------
# DELETE FOR EVERYONE
# ---------------------------

@api_router.delete("/messages/{message_id}")
async def delete_message_permanently(message_id: str, admin_user: dict = Depends(get_current_admin_user)):
    """
    (Admin Only) Permanently delete a specific message by ID from the database.
    """
    try:
        # Try deleting from Channel_chat first
        result_channel = await chat_db.Channel_chat.delete_one({"id": message_id})
        # Then try Direct_chat
        result_direct = await chat_db.Direct_chat.delete_one({"id": message_id})

        if result_channel.deleted_count == 0 and result_direct.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Message not found")
        
        logging.info(f"Admin '{admin_user.get('email')}' permanently deleted message '{message_id}'.")
        return {"message": "Message permanently deleted successfully"}
    except HTTPException:
        raise
@api_router.post("/messages/{message_id}/delete-everyone")
async def delete_message_for_everyone(
    message_id: str,
    user_id: str = Query(...)
):
    """
    Delete a message for everyone by replacing its content with a placeholder.
    Only the sender can delete their message for everyone.
    """
    try:
        if message_id.startswith("optimistic-"):
            raise HTTPException(status_code=400, detail="Cannot delete optimistic message still being sent")

        # Find the message and determine its type
        message = await chat_db.Channel_chat.find_one({"id": message_id})
        collection = chat_db.Channel_chat
        is_channel_message = True
        if not message:
            message = await chat_db.Direct_chat.find_one({"id": message_id})
            collection = chat_db.Direct_chat
            is_channel_message = False

        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        if message.get("sender_id") != user_id:
            raise HTTPException(status_code=403, detail="Not allowed to delete this message")

        # Update the message in the database
        await collection.update_one(
            {"id": message_id},
            {"$set": {
                "content": "This message was deleted",
                "deleted": True,
                "deleted_at": datetime.now(ist_tz)
            }}
        )

        # Prepare the update payload for broadcast
        update_json = json.dumps({
            "type": "message_update",
            "message_id": message_id,
            "updates": {"content": "This message was deleted", "deleted": True}
        })

        # Broadcast the update to the correct audience
        if is_channel_message:
            channel_id = message.get("channel_id")
            if channel_id:
                await manager.broadcast_to_channel(update_json, channel_id, stc_db)
        else:
            # For direct messages, send only to the sender and recipient
            sender = message.get("sender_id")
            recipients = message.get("recipient_id")

            if sender:
                await manager.send_personal_message(update_json, sender)
            if recipients:
                if isinstance(recipients, list):
                    for recipient_id in recipients:
                        await manager.send_personal_message(update_json, recipient_id)
                elif isinstance(recipients, str):
                    await manager.send_personal_message(update_json, recipients)

        return {"message": "Message deleted for everyone"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting message {message_id} for everyone: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete message for everyone")
# ---------------------------
# TTL INDEXES (Auto-clean)
# ---------------------------

@app.on_event("startup")
async def setup_indexes():
    try:
        # DeletedMessages auto-expire after 30 days
        await chat_db.DeletedMessages.create_index(
            "created_at",
            expireAfterSeconds=60 * 60 * 24 * 30  # 30 days
        )

        # Channel & Direct chat: auto-remove globally deleted messages after 90 days
        await chat_db.Channel_chat.create_index(
            "deleted_at",
            expireAfterSeconds=60 * 60 * 24 * 90  # 90 days
        )
        await chat_db.Direct_chat.create_index(
            "deleted_at",
            expireAfterSeconds=60 * 60 * 24 * 90
        )

        logging.info("TTL indexes created for DeletedMessages (30d) and deleted messages (90d)")
    except Exception as e:
        logging.error(f"Failed to create TTL indexes: {e}")


async def check_scheduled_announcements():
    """
    A background task that runs continuously to check for and publish scheduled announcements.
    """
    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            
            # Find announcements that are scheduled and due
            due_announcements = await chat_db.Announcements.find({
                "status": "scheduled",
                "scheduled_at": {"$lte": now_utc}
            }).to_list(length=None)

            for ann in due_announcements:
                logging.info(f"Publishing scheduled announcement: {ann['title']}")
                
                # Update status to 'published'
                await chat_db.Announcements.update_one(
                    {"_id": ann["_id"]},
                    {"$set": {"status": "published", "date": now_utc}}
                )

                # Update the announcement object in memory before broadcasting
                # so the frontend receives the correct publication time.
                ann["date"] = now_utc

                # Broadcast the announcement
                broadcast_payload = {
                    "type": "new_announcement",
                    "data": serialize_document(ann) # serialize_document will convert now_utc to IST
                }
                await manager.broadcast(json.dumps(broadcast_payload))

        except Exception as e:
            logging.error(f"Error in scheduled announcement checker: {e}")
        
        await asyncio.sleep(60) # Check every 60 seconds

@api_router.post("/employees", response_model=Employee)
async def create_employee(employee: Employee):
    employee_dict = employee.model_dump()
    # Insert into team-specific collection (auto-creates if missing)
    team_collection = stc_db[sanitize_team(employee.team)]
    await team_collection.insert_one(employee_dict)
    return employee

@api_router.get("/employees")
async def get_all_employees():
    try:
        all_employees = {}
        # Iterate only through collections corresponding to known teams
        # This prevents errors from trying to query system or unrelated collections.
        sanitized_team_names = [sanitize_team(team) for team in TEAMS]

        for name in sanitized_team_names:
            try:
                collection = stc_db[name]
                users = await collection.find(
                    {},
                    {"_id": 0, "password_hash": 0}  # Exclude sensitive fields
                ).to_list(None)
                for user in users:
                    # Use email as a unique key to avoid duplicates
                    if user.get("email"):
                        all_employees[user["email"]] = user
            except Exception as e:
                logging.warning(f"Could not fetch from collection {collection.name}: {e}")

        employees = list(all_employees.values())
        logging.info(f"Total unique employees fetched from all teams: {len(employees)}")
        return serialize_document(employees)
    except Exception as e:
        logging.error(f"Error fetching employees: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch employees")

@api_router.get("/employees/{employee_id}", response_model=Employee)
async def get_employee(employee_id: str):
    # Search across all team collections
    collection_names = await stc_db.list_collection_names()
    team_collections = [stc_db[name] for name in collection_names]
    for collection in team_collections:
        employee = await collection.find_one({"id": employee_id})
        if employee:
            return employee
    raise HTTPException(status_code=404, detail="Employee not found")

@api_router.put("/employees/{employee_id}", response_model=Employee)
async def update_employee(employee_id: str, employee: Employee):
    employee_dict = employee.model_dump(exclude_unset=True)
    # Find and update in the appropriate collection
    collection_names = await stc_db.list_collection_names()
    team_collections = [stc_db[name] for name in collection_names]
    for collection in team_collections:
        existing = await collection.find_one({"id": employee_id})
        if existing:
            await collection.update_one({"id": employee_id}, {"$set": employee_dict})
            updated_employee = await collection.find_one({"id": employee_id})
            return updated_employee
    raise HTTPException(status_code=404, detail="Employee not found")

class ProfilePictureUpdate(BaseModel):
    profilePicture: Optional[str]

@api_router.put("/employees/{employee_id}/profile-picture", status_code=200)
async def update_profile_picture(employee_id: str, body: ProfilePictureUpdate):
    """
    Updates the profile picture for a given employee.
    The request body should be JSON: {"profilePicture": "data:image/..."}
    """
    try:
        user, collection = await get_user_info_with_collection(stc_db, employee_id)
 
        if not user or collection is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        await collection.update_one(
            {"$or": [{"id": employee_id}, {"email": employee_id}]},
            {"$set": {"profilePicture": body.profilePicture}}
        )

        updated_user = await collection.find_one(
            {"$or": [{"id": employee_id}, {"email": employee_id}]},
            {"_id": 0, "password_hash": 0}
        )
        return serialize_document(updated_user)
    except Exception as e:
        logging.error(f"Error updating profile picture for {employee_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile picture.")

@api_router.get("/employees/work-details/")
async def get_employees_work_details(email: Optional[str] = None):
    """
    Gets all employees and enriches their data with reviewer info.
    If an email is provided, it returns the details for only that employee.
    """
    try:
        # Collect all employees from all collections
        all_employees_dict = {}
        collection_names = await stc_db.list_collection_names()
        for name in collection_names:
            try:
                collection = stc_db[name]
                users = await collection.find({}, {"_id": 0, "password_hash": 0}).to_list(None)
                for user in users:
                    if user.get("email"):
                        all_employees_dict[user["email"]] = user
            except Exception as e:
                logging.warning(f"Could not fetch employees from {name}: {e}")

        all_employees = list(all_employees_dict.values())

        # Create a map of employee names to their full data for easy lookup
        employee_by_name = {emp.get("name"): emp for emp in all_employees if emp.get("name")}
        # Create a map of Zonal Managers to their reviewers
        zonal_manager_reviewers = {name: data.get("reviewer") for name, data in employee_by_name.items() if data.get("designation", "").lower().strip() == "zonal managers"}

        # Define the specific reviewers for each team's reporting manager
        reporting_manager_reviewers = {
            "Research": "Alimpan Banerjee, Anant Tiwari",
            "Media": "Anant Tiwari",
            "Data": "Anant Tiwari",
            "Digital Production": "Anant Tiwari",
            "Digital Communication": "Anant Tiwari",
            "Propagation": "Lokesh Mathur",
            "Neagitive Propagation": "Anant Tiwari",
            "Digital Marketing/Networking": "Saumitra, Anurag",
            "HIVE": "Anant Tiwari",
            "Campaign": "Anant Tiwari, Alimpan Banerjee",
            "Soul Central": "Alimpan Banerjee",
            "Field Team AP-1": "Alimpan Banerjee",
            "Field Team AP-2": "Alimpan Banerjee",
            "Field Team TG": "Alimpan Banerjee",
            "PMU": "Alimpan Banerjee",
            "Directors Team-1": "Anant Tiwari, Alimpan Banerjee",
            "Directors Team-2": "Anant Tiwari, Alimpan Banerjee",
            "Directors Team-3": "Anant Tiwari, Alimpan Banerjee",
            "HR": "Robbin Sharma, Anant Tiwari, Alimpan Banerjee, Khushboo Sharma",
            "Operations": "Robbin Sharma, Anant Tiwari, Alimpan Banerjee, Khushboo Sharma",
            "System Admin": "Management"
        }

        # Create a map of each team to its reporting manager(s).
        reporting_managers_by_team = {}
        for emp in all_employees:
            designation = emp.get("designation", "").lower()
            team_name = emp.get("team")
            if designation == "reporting manager" and team_name:
                if team_name not in reporting_managers_by_team:
                    reporting_managers_by_team[team_name] = []
                reporting_managers_by_team[team_name].append(emp.get("name"))

        processed_employees = []
        for emp in all_employees:
            enriched_emp = emp.copy()
            designation = enriched_emp.get("designation", "").lower().strip()
            team = enriched_emp.get("team")
            reviewer = enriched_emp.get("reviewer") # Keep existing reviewer if present
            original_reviewer = reviewer  # For logging

            # Step 1: Handle specific role assignments first.
            if designation == "reporting manager":
                # Assign specific reviewers based on the manager's team.
                enriched_emp["reviewer"] = reporting_manager_reviewers.get(team, "Management")
            
            # Step 2: Handle hierarchical assignments for employees and zonal managers.
            elif designation in ["employee", "zonal manager", "zonal managers"]:
                # Only assign a reviewer if one isn't already set.
                if not reviewer:
                    # If an employee's reviewer is a Zonal Manager, get the ZM's reviewer.
                    if designation == "employee" and reviewer and reviewer in zonal_manager_reviewers:
                        enriched_emp["reviewer"] = zonal_manager_reviewers.get(reviewer)
                        print(f"Re-assigning reviewer for '{enriched_emp.get('name')}': from ZM '{reviewer}' to '{enriched_emp['reviewer']}'")
                    elif team and team in reporting_managers_by_team:
                        enriched_emp["reviewer"] = ", ".join(sorted(reporting_managers_by_team[team]))
            
            # Step 3: Final fallback for any unassigned reviewers.
            # This covers directors and any other roles.
            # It also catches employees/ZMs whose teams have no reporting manager.
            if not enriched_emp.get("reviewer"):
                enriched_emp["reviewer"] = "Not Assigned"
            
            if enriched_emp.get("reviewer") != original_reviewer:
                print(f"Reviewer for '{enriched_emp.get('name')}' ({designation}) changed from '{original_reviewer}' to '{enriched_emp.get('reviewer')}'")

            processed_employees.append(enriched_emp)

        # If an email is provided, filter for that user
        if email:
            user_details = next((e for e in processed_employees if e.get("email") == email), None)
            # Always return an array, even if it's a single user or empty
            if user_details:
                return serialize_document([user_details])
            else:
                return []
        
        return serialize_document(processed_employees)
    except Exception as e:
        logging.error(f"Error fetching work-details: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch employees work details")

@api_router.post("/employees/update-reviewers", status_code=200)
async def update_all_employee_reviewers():
    """
    Calculates and updates the 'reviewer' field for all employees in the database.
    This is an administrative endpoint to persist the calculated reviewer data.
    """
    try:
        # 1. Collect all employees from all collections
        all_employees_dict = {}
        collection_names = await stc_db.list_collection_names()
        for name in collection_names:
            collection = stc_db[name]
            users = await collection.find({}, {"_id": 0, "password_hash": 0}).to_list(None)
            for user in users:
                if user.get("email"):
                    all_employees_dict[user["email"]] = user

        all_employees = list(all_employees_dict.values())

        # 2. Calculate reviewers using the same logic as get_employees_work_details
        employee_by_name = {emp.get("name"): emp for emp in all_employees if emp.get("name")}
        zonal_manager_reviewers = {name: data.get("reviewer") for name, data in employee_by_name.items() if data.get("designation", "").lower().strip() == "zonal managers"}

        reporting_manager_reviewers = {
            "Research": "Alimpan Banerjee, Anant Tiwari", "Media": "Anant Tiwari", "Data": "Anant Tiwari",
            "Digital Production": "Anant Tiwari", "Digital Communication": "Anant Tiwari", "Propagation": "Lokesh Mathur",
            "Neagitive Propagation": "Anant Tiwari", "Digital Marketing/Networking": "Saumitra, Anurag", "HIVE": "Anant Tiwari",
            "Campaign": "Anant Tiwari, Alimpan Banerjee", "Soul Central": "Alimpan Banerjee", "Field Team AP-1": "Alimpan Banerjee",
            "Field Team AP-2": "Alimpan Banerjee", "Field Team TG": "Alimpan Banerjee", "PMU": "Alimpan Banerjee",
            "Directors Team-1": "Anant Tiwari, Alimpan Banerjee", "Directors Team-2": "Anant Tiwari, Alimpan Banerjee",
            "Directors Team-3": "Anant Tiwari, Alimpan Banerjee", "HR": "Robbin Sharma, Anant Tiwari, Alimpan Banerjee, Khushboo Sharma",
            "Operations": "Robbin Sharma, Anant Tiwari, Alimpan Banerjee, Khushboo Sharma", "System Admin": "Management"
        }

        reporting_managers_by_team = {}
        for emp in all_employees:
            designation = emp.get("designation", "").lower()
            team_name = emp.get("team")
            if designation == "reporting manager" and team_name:
                if team_name not in reporting_managers_by_team:
                    reporting_managers_by_team[team_name] = []
                reporting_managers_by_team[team_name].append(emp.get("name"))

        updated_count = 0
        for emp in all_employees:
            new_reviewer = emp.get("reviewer") # Start with existing
            designation = emp.get("designation", "").lower().strip()
            team = emp.get("team")

            if designation == "reporting manager":
                new_reviewer = reporting_manager_reviewers.get(team, "Management")
            elif designation in ["employee", "zonal manager", "zonal managers"]:
                if not emp.get("reviewer"): # Only if reviewer is not already set
                    if designation == "employee" and emp.get("reviewer") and emp.get("reviewer") in zonal_manager_reviewers:
                        new_reviewer = zonal_manager_reviewers.get(emp.get("reviewer"))
                    elif team and team in reporting_managers_by_team:
                        new_reviewer = ", ".join(sorted(reporting_managers_by_team[team]))

            if not new_reviewer:
                new_reviewer = "Not Assigned"

            # 3. Update the employee record in the database if the reviewer has changed
            if new_reviewer != emp.get("reviewer"):
                _user, collection = await get_user_info_with_collection(stc_db, emp["email"])
                if collection:
                    result = await collection.update_one(
                        {"email": emp["email"]},
                        {"$set": {"reviewer": new_reviewer}}
                    )
                    if result.modified_count > 0:
                        updated_count += 1
                        logging.info(f"Updated reviewer for {emp['name']} to '{new_reviewer}'")

        return {"message": f"Reviewer update process completed. {updated_count} employees updated."}
    except Exception as e:
        logging.error(f"Error updating employee reviewers: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update employee reviewers.")

@api_router.get("/employees/code/{emp_code}")
async def get_employee_by_code(emp_code: str):
    try:
        collection_names = await stc_db.list_collection_names()
        team_collections = [stc_db[name] for name in collection_names]

        for collection in team_collections:
            try:
                # Use a case-insensitive regex for the employee code
                emp_code_regex = re.compile(f"^{re.escape(emp_code)}$", re.IGNORECASE)
                employee = await collection.find_one(
                  {"$or": [
                    {"empCode": emp_code_regex},
                    {"Emp code": emp_code_regex} # Keep this for different key names
                   ]},
                   {"password_hash": 0, "_id": 0}
               )

                if employee:
                    employee = serialize_document(employee)
                    return employee
            except Exception as e:
                logging.warning(f"Skipping collection {collection.name} due to error: {e}")
                continue

        raise HTTPException(status_code=404, detail="Employee not found")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get employee by code {emp_code}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch employee by code")


@api_router.get("/employees/email/{email}")
async def get_employee_by_email(email: str):
    try:
        email = email.strip()

        collection_names = await stc_db.list_collection_names()
        team_collections = [stc_db[name] for name in collection_names]

        for collection in team_collections:
            try:
                # Try by id first (exact match)
                employee = await collection.find_one({"id": email}, {"password_hash": 0, "_id": 0})
                if employee:
                    employee = serialize_document(employee)
                    return employee
                # Then by email with case-insensitive regex
                email_regex = re.compile(f"^{re.escape(email)}$", re.IGNORECASE)
                employee = await collection.find_one({"email": email_regex}, {"password_hash": 0, "_id": 0})
                if employee:
                    # Ensure password hash is not in the final output, just in case
                    employee.pop("password_hash", None)
                    employee = serialize_document(employee)
                    return employee
            except Exception as e:
                logging.warning(f"Skipping collection {collection.name} due to error: {e}")
                continue

        raise HTTPException(status_code=404, detail="Employee not found")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get employee by email {email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch employee")


def serialize_employee(employee: dict) -> dict:
    """
    Custom serializer for a single employee document to handle ObjectId and datetime.
    """
    if not employee:
        return None
    if '_id' in employee:
        employee['_id'] = str(employee['_id'])
    for key, value in employee.items():
        if isinstance(value, datetime):
            employee[key] = value.isoformat()
    return employee

@api_router.delete("/employees/{employee_id}/profile-picture", status_code=200)
async def remove_profile_picture(employee_id: str):
    """
    Removes the profile picture for a given employee by setting it to null.
    """
    try:
        # Find the user and their collection
        user, collection = await get_user_info_with_collection(stc_db, employee_id)

        if not user or collection is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        # Set the profile picture to null in the database
        await collection.update_one(
            {"$or": [{"id": employee_id}, {"email": employee_id}]},
            {"$set": {"profilePicture": None}}
        )

        # Fetch and return the updated user document to confirm the change
        updated_user = await collection.find_one(
            {"$or": [{"id": employee_id}, {"email": employee_id}]},
            {"_id": 0, "password_hash": 0}
        )
        return serialize_document(updated_user)
    except Exception as e:
        logging.error(f"Error removing profile picture for {employee_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove profile picture.")

@api_router.put("/employees/{employeeId}/deactivate")
async def deactivate_employee(employeeId: str, admin_user: dict = Depends(get_current_admin_user) ):
    try:
        # Find the user and their collection across all teams
        decoded_employee_id = urllib.parse.unquote(employeeId)
        user, collection = await get_user_info_with_collection(stc_db, decoded_employee_id)

        if not user or collection is None:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Soft delete: Mark the user as inactive instead of deleting them.
        result = await collection.update_one(
            {"email": re.compile(f"^{re.escape(decoded_employee_id)}$", re.IGNORECASE)},
            {"$set": {"active": False}}
        )

        if result.modified_count > 0:
            logging.info(f"Employee {decoded_employee_id} deactivated by admin {admin_user.get('email')}.")
            return {"message": "Employee account has been deactivated."}
        
        raise HTTPException(status_code=404, detail="Employee was found but could not be deactivated.")
    except HTTPException:
        raise  # Re-raise HTTPException to preserve status code and detail
    except Exception as e:
        logging.error(f"Error deactivating employee {employeeId}: {e}")
        raise HTTPException(status_code=500, detail="Error deactivating employee")

@api_router.put("/users/me/deactivate")
@api_router.delete("/users/me")
async def deactivate_self(
    authorization: str = Header(..., alias="Authorization"),
):
    """
    Allows a currently authenticated user to deactivate their own account.
    Allows a currently authenticated user to permanently delete their own account.
    The user is identified via their Authorization token.
    """
    try:
        # We can reuse the admin dependency logic to get the user from the token,
        # but we don't need to check for admin privileges here.
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Not authenticated")
        

        token_str = authorization.split(" ")[1]
        decoded_token = base64.b64decode(token_str).decode('utf-8')
        user_data_from_token = json.loads(decoded_token)
        user_email = user_data_from_token.get("email")

        if not user_email:
            raise HTTPException(status_code=401, detail="Invalid token: email missing.")
            raise HTTPException(status_code=401, detail="Invalid token: user email missing.")

        # Use the existing admin-level deactivate function, but pass the user's own email
        # and a dummy admin_user object to satisfy the dependency.
        return await deactivate_employee(employeeId=user_email, admin_user={"email": user_email})
        user, collection = await get_user_info_with_collection(stc_db, user_email)

        if not user or collection is None:
            raise HTTPException(status_code=404, detail="User to be deleted not found.")

        result = await collection.delete_one({"email": re.compile(f"^{re.escape(user_email)}$", re.IGNORECASE)})

        if result.deleted_count > 0:
            logging.info(f"User {user_email} has permanently deleted their own account.")
            return {"message": "Your account has been permanently deleted."}
        
        raise HTTPException(status_code=500, detail="Account could not be deleted.")
    except Exception as e:
        logging.error(f"Error during self-deactivation for token: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during account deactivation.")

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.put("/users/{user_id}/change-password")
async def change_password(user_id: str, request: PasswordChangeRequest, admin_user: Optional[dict] = None) -> JSONResponse:
    """
    Changes the password for a given user.
    If is_admin_reset is True, it bypasses the current password check.
    """
    if len(request.new_password) > 72:
        raise HTTPException(status_code=400, detail="Password cannot exceed 72 characters.")

    try:
        # Find the user and their collection
        # We need the password hash, so we must set include_hash=True
        user, collection = await get_user_info_with_collection(stc_db, user_id, include_hash=True)

        if not user or collection is None:
            raise HTTPException(status_code=404, detail="User not found")

        # Verify the current password, unless it's an admin reset
        if not admin_user: # This is a regular user changing their own password
            password_hash = user.get("password_hash")
            if not password_hash or not pwd_context.verify(request.current_password, password_hash):
                raise HTTPException(status_code=400, detail="Incorrect current password")

        # Hash the new password
        new_password_hash = pwd_context.hash(request.new_password)

        # Update the password in the database
        result = await collection.update_one(
            {"email": re.compile(f"^{re.escape(user_id)}$", re.IGNORECASE)},
            {"$set": {"password_hash": new_password_hash}}
        )

        if result.modified_count > 0:
            if admin_user:
                logging.info(f"Admin '{admin_user.get('email')}' reset password for user '{user_id}'.")
            return JSONResponse(content={"message": "Password updated successfully"})
        raise HTTPException(status_code=500, detail="Failed to update password")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error changing password for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to change password.")

@api_router.put("/users/{email}/profile")
async def update_user_profile(email: str, profile_data: UserProfileUpdate):
    """
    Updates a user's profile information (name, phone, etc.).
    This is the endpoint for users updating their own details.
    """
    try:
        # Find the user and their collection
        user, collection = await get_user_info_with_collection(stc_db, email)

        if not user or collection is None:
            raise HTTPException(status_code=404, detail="User not found")

        # Create an update payload with only the fields that were provided
        # Use exclude_unset=True to only include fields explicitly sent by the client.
        update_data = profile_data.model_dump(exclude_unset=True)

        # Convert date_of_birth string to datetime object if present
        if 'date_of_birth' in update_data and isinstance(update_data['date_of_birth'], str):
            try:
                # The frontend might send a full ISO string or just 'YYYY-MM-DD'
                dob_str = update_data['date_of_birth']
                # Create a datetime object at midnight UTC
                update_data['date_of_birth'] = datetime.strptime(dob_str.split('T')[0], '%Y-%m-%d').replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                # If parsing fails, store it as is or handle the error
                logging.warning(f"Could not parse date_of_birth: {update_data['date_of_birth']}")

        # If email is being changed, ensure the new one isn't already taken
        new_email = update_data.get("email")
        if new_email and new_email.lower() != email.lower():
            existing_user, _ = await get_user_info_with_collection(stc_db, new_email)
            if existing_user:
                raise HTTPException(status_code=400, detail="Email already in use by another account.")
            # If the email is changing, we should also update the 'id' field
            # since it's being used as a primary identifier based on the email.
            update_data['id'] = new_email

        if not update_data:
            raise HTTPException(status_code=400, detail="No update data provided.")

        # Perform the update
        # Use the user's original email from the path for the query
        result = await collection.update_one(
            {"email": re.compile(f"^{re.escape(email)}$", re.IGNORECASE)},
            {"$set": update_data}
        )

        # If email was changed, also update the chat_db.employees collection for consistency
        if new_email and new_email.lower() != email.lower():
            await chat_db.employees.update_one(
                {"email": re.compile(f"^{re.escape(email)}$", re.IGNORECASE)},
                {"$set": {"email": new_email, "id": new_email}}
            )
            logging.info(f"Updated email in chat_db.employees for user {email} to {new_email}")


        # Fetch the updated user document to return to the client
        # Use the new email if it was changed, otherwise the original email
        final_email_to_find = new_email or email
        updated_user = await collection.find_one(
            {"email": re.compile(f"^{re.escape(final_email_to_find)}$", re.IGNORECASE)},
            {"_id": 0, "password_hash": 0} # Exclude sensitive fields
        )

        return serialize_document(updated_user)

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating profile for {email}: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while updating the profile.")

@api_router.post("/signup")
async def signup(request: SignupRequest):
    if len(request.password) > 72:
        raise HTTPException(status_code=400, detail="Password cannot exceed 72 characters.")

    # Add validation for email format
    if not re.match(r"[^@]+@[^@]+\.[^@]+", request.email):
        raise HTTPException(status_code=400, detail="Password cannot exceed 72 characters.")

    if request.team not in TEAMS:
        raise HTTPException(status_code=400, detail=f"Invalid team. Must be one of: {', '.join(TEAMS)}")

    # Check existence across all team collections
    collection_names = await stc_db.list_collection_names()
    team_collections = [stc_db[name] for name in collection_names]
    existing = None
    for collection in team_collections:
        existing = await collection.find_one({"email": request.email})
        if existing:
            break

    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    hashed = pwd_context.hash(request.password)
    
    # Set department: use provided or fallback to team
    dept = request.department if request.department else request.team
    # Set designation: use provided or default
    desig = request.designation if request.designation else "Employee"
    
    # --- Calculate Reviewer ---
    new_reviewer = "Not Assigned"
    try:
        # 1. Define the reviewer hierarchy maps
        reporting_manager_reviewers_map = {
            "Research": "Alimpan Banerjee , Anant Tiwari", "Media": "Anant Tiwari", "Data": "Anant Tiwari",
            "Digital Production": "Anant Tiwari", "Digital Communication": "Anant Tiwari", "Propagation": "Lokesh Mathur",
            "Neagitive Propagation": "Anant Tiwari", "Digital Marketing/Networking": "Saumitra, Anurag", "HIVE": "Anant Tiwari",
            "Campaign": "Anant Tiwari, Alimpan Banerjee", "Soul Central": "Alimpan Banerjee", "Field Team AP-1": "Alimpan Banerjee",
            "Field Team AP-2": "Alimpan Banerjee", "Field Team TG": "Alimpan Banerjee", "PMU": "Alimpan Banerjee",
            "Directors Team-1": "Anant Tiwari, Alimpan Banerjee", "Directors Team-2": "Anant Tiwari, Alimpan Banerjee",
            "Directors Team-3": "Anant Tiwari, Alimpan Banerjee", "HR": "Robbin Sharma, Anant Tiwari, Alimpan Banerjee, Khushboo Sharma",
            "Operations": "Robbin Sharma, Anant Tiwari, Alimpan Banerjee, Khushboo Sharma", "System Admin": "Management"
        }

        # 2. Find the reporting manager for the new user's team
        team_reporting_manager = None
        all_collections = await stc_db.list_collection_names()
        for name in all_collections:
            collection = stc_db[name]
            # Find a user in the same team with the designation of "reporting manager"
            manager = await collection.find_one({
                "team": request.team,
                "designation": {"$regex": "reporting manager", "$options": "i"}
            })
            if manager:
                team_reporting_manager = manager.get("name")
                break
        
        # 3. Assign reviewer based on designation
        if desig.lower().strip() == "reporting manager":
            # The new user is a reporting manager, their reviewer is from the map.
            new_reviewer = reporting_manager_reviewers_map.get(request.team, "Management")
        elif desig.lower().strip() == "employee":
            # The new user is an employee, their reviewer is their team's reporting manager.
            if team_reporting_manager:
                new_reviewer = team_reporting_manager
            else:
                logging.warning(f"No reporting manager found for team '{request.team}' during signup for {request.email}.")
        
        if not new_reviewer:
            new_reviewer = "Not Assigned"

    except Exception as e:
        logging.error(f"Error calculating reviewer during signup for {request.email}: {e}")

    # Handle date of birth
    dob = None
    if request.date_of_birth:
        try:
            dob = datetime.strptime(request.date_of_birth, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        except ValueError:
            logging.warning(f"Invalid date_of_birth format during signup: {request.date_of_birth}")

    employee_data = EmployeeCreate(
        id=request.email,
        name=request.name,
        email=request.email,
        designation=desig,
        department=dept,
        team=request.team,
        empCode=request.empCode,
        phone=request.phone,
        emergency_contact=request.emergency_contact,
        date_of_birth=dob,
        profilePicture=request.profilePicture,
        password_hash=hashed,
        reviewer=new_reviewer # Assign the calculated reviewer
    )
    
    # Insert into team-specific collection (auto-creates if missing)
    team_collection = stc_db[sanitize_team(request.team)]
    await team_collection.insert_one(employee_data.model_dump())

    return {"message": "User created successfully"}

from bson import ObjectId

def convert_objectid(doc: dict) -> dict:
    """Recursively converts ObjectId fields to strings"""
    if not doc:
        return doc
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        elif isinstance(v, dict):
            doc[k] = convert_objectid(v)
        elif isinstance(v, list):
            doc[k] = [convert_objectid(i) if isinstance(i, dict) else i for i in v]
    return doc
@api_router.post("/login")
async def login(request: LoginRequest):
    # Search across all team collections by id or email
    collection_names = await stc_db.list_collection_names()
    team_collections = [stc_db[name] for name in collection_names]
    user = None
    for collection in team_collections:
        # Try by id first
        user = await collection.find_one({"id": request.identifier})
        if user:
            break
        # Then by email
        user = await collection.find_one({"email": request.identifier})
        if user:
            break

    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    password_hash = user.get("password_hash")
    if not password_hash:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    if not pwd_context.verify(request.password, password_hash):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    # --- ADDED: Check if the user account is active ---
    # If 'active' is False, deny login. Treat missing 'active' field as active.
    if user.get("active") is False:
        raise HTTPException(status_code=403, detail="Account is deactivated. Please contact an administrator.")

    # Set user status to online and broadcast it immediately upon successful login
    user_id = user.get("email") or user.get("id")
    await manager.broadcast_status(user_id, "online")

    user_data = {k: v for k, v in user.items() if k != "password_hash"}    
    user_data = convert_objectid(user_data)
    
    # Ensure profilePicture is included, even if it's null
    if 'profilePicture' not in user_data:
        user_data['profilePicture'] = None
    return user_data


# File upload endpoint
@api_router.post("/files/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    try:
        if not file:
            raise HTTPException(status_code=400, detail="No file provided")

        # Read file content into memory to get size and for uploading
        content = await file.read()
        file_size = len(content)

        # Upload file to GridFS
        file_id = await grid_fs.upload_from_stream(
            file.filename,
            content,
            metadata={"contentType": file.content_type}
        )

        # Dynamically create the file URL
        base_url = str(request.base_url)
        # The URL now points to the new download endpoint with the GridFS file ID
        file_url = f"{base_url}api/files/download/{str(file_id)}"

        # Return file metadata
        return {
            "id": str(file_id),
            "file_name": file.filename,
            "file_type": file.content_type,
            "file_size": file_size,
            "file_url": file_url
        }
    except Exception as e:
        logging.error(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail="File upload failed")

@api_router.post("/upload-ap-mapping")
async def upload_ap_mapping(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        data = df.to_dict('records')

        # Clear existing data
        await main_db.ap_booth_mapping.delete_many({})
        # Insert new data
        await main_db.ap_booth_mapping.insert_many(data)

        return {"message": "AP mapping data uploaded successfully"}
    except Exception as e:
        logging.error(f"AP mapping file upload failed: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred while processing the file.")

@api_router.get("/ap-mapping-data")
async def get_ap_mapping_data(
    zone: Optional[str] = None,
    district: Optional[str] = None,
    parliament: Optional[str] = None,
    assembly: Optional[str] = None,
):
    try:
        query = {}
        if zone:
            query["Zone"] = zone
        if district:
            query["District"] = district
        if parliament:
            query["Parliament Constituency"] = parliament
        if assembly:
            query["Assembly Constituency"] = assembly

        data = await main_db.ap_booth_mapping.find(query).to_list(length=None)
        return serialize_document(data)
    except Exception as e:
        logging.error(f"Failed to fetch AP mapping data: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch AP mapping data.")
    
@api_router.post("/attendance-report")
async def save_attendance_report(employees: List[EmployeeAttendance] = Body(...)):
    try:
        print(f"Received attendance data for {len(employees)} employees.")
        
        for employee_data in employees:
            # Use model_dump to convert Pydantic model to a dictionary
            employee_dict = employee_data.model_dump()
            
            # Find existing employee record by empCode
            existing_employee = await attendance_db.Attendance.find_one({"empCode": employee_data.empCode})
            
            if existing_employee:
                # If employee exists, push new dailyRecords
                await attendance_db.Attendance.update_one(
                    {"empCode": employee_data.empCode},
                    {"$push": {"dailyRecords": {"$each": employee_dict['dailyRecords']}}}
                )
            else:
                # If employee does not exist, insert a new document
                await attendance_db.Attendance.insert_one(employee_dict)

        return {"message": "Attendance data saved or updated successfully"}
    except Exception as e:
        logging.error(f"Error saving attendance data: {e}")
        raise HTTPException(status_code=500, detail=f"Error saving data: {e}")

@api_router.get("/attendance-report")
async def get_attendance_report(
    view_type: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    date: Optional[str] = None
):
    try:
        pipeline = []

        # If filtering parameters are provided, build the projection stage
        if view_type == 'month' and year and month:
            pipeline.extend([
                # Deconstruct the dailyRecords array
                {"$unwind": "$dailyRecords"},
                # Filter the records for the selected month and year
                {"$match": {
                    "dailyRecords.date": {
                        "$gte": datetime(year, month, 1, tzinfo=timezone.utc),
                        "$lt": datetime(year, month + 1, 1, tzinfo=timezone.utc) if month < 12 else datetime(year + 1, 1, 1, tzinfo=timezone.utc)
                    }
                }},
                # Group back by employee to calculate summaries and collect records
                {"$group": {
                    "_id": "$empCode",
                    "empName": {"$first": "$empName"},
                    "dailyRecords": {"$push": "$dailyRecords"},
                    "P": {
                        "$sum": {
                            "$cond": [{"$eq": ["$dailyRecords.status", "P"]}, 1, 0]
                        }
                    },
                    "A": {
                        "$sum": {
                            "$cond": [{"$eq": ["$dailyRecords.status", "A"]}, 1, 0]
                        }
                    },
                    "H": {
                        "$sum": {
                            "$cond": [{"$in": ["$dailyRecords.status", ["H", "Holiday"]]}, 1, 0]
                        }
                    },
                    "L": {
                        "$sum": {
                            "$cond": [
                                {"$and": [
                                    {"$eq": ["$dailyRecords.status", "P"]},
                                    {"$ne": ["$dailyRecords.lateBy", "00:00"]},
                                    {"$ne": ["$dailyRecords.lateBy", None]}
                                ]}, 1, 0]
                            }
                        }
                    
                }},
                # Project the final fields
                {"$project": {
                    "_id": 0,
                    "empCode": "$_id",
                    "empName": "$empName",
                    "dailyRecords": 1,
                    "P": 1, "A": 1, "H": 1, "L": 1
                }}
            ])
        elif view_type == 'day' and date:
            try:
                target_date = datetime.strptime(date, '%Y-%m-%d')
                pipeline.append({
                    "$project": {
                        "empCode": 1,
                        "empName": 1,
                        "dailyRecords": {
                            "$filter": {
                                "input": "$dailyRecords",
                                "as": "record",
                                "cond": {
                                    "$and": [
                                        {"$eq": [{"$year": "$$record.date"}, target_date.year]},
                                        {"$eq": [{"$month": "$$record.date"}, target_date.month]},
                                        {"$eq": [{"$dayOfMonth": "$$record.date"}, target_date.day]}
                                    ]
                                }
                            }
                        }
                    }
                })
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

        if pipeline:
            attendance_records = await attendance_db.Attendance.aggregate(pipeline).to_list(length=None)
        else:
            # Fetch all records if no filters are applied
            attendance_records = await attendance_db.Attendance.find().to_list(length=None)
        
        sanitized_records = serialize_document(attendance_records)
        logging.info(f"Retrieved {len(attendance_records)} attendance records from database")
        return {"data": sanitized_records, "count": len(sanitized_records)}
    except Exception as e:
        logging.error(f"Failed to fetch attendance report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch attendance data: {e}")

# --- Attendance Report Endpoint ---
@api_router.get("/attendance-report/user/{employee_code}")
async def get_attendance_report(
    employee_code: str,
    view_type: str,
    year: int = None,
    month: int = None,
    date: str = None
):
    try:
        attendance_collection = attendance_db["Attendance"]
        # Build the aggregation pipeline to handle the nested dailyRecords
        pipeline: List[Dict] = [
            {"$match": {"empCode": employee_code}}
        ]
        
        if view_type == 'month' and year and month:
            pipeline.append({
                "$project": {
                    "empCode": "$empCode",
                    "empName": "$empName",
                    "dailyRecords": {
                        "$filter": {
                            "input": "$dailyRecords",
                            "as": "record",
                            "cond": {
                                "$and": [
                                    {"$eq": [{"$year": "$$record.date"}, year]},
                                    {"$eq": [{"$month": "$$record.date"}, month]}
                                ]
                            }
                        }
                    }
                }
            })
        elif view_type == 'day' and date:
            try:
                target_date = datetime.strptime(date, '%Y-%m-%d')
                pipeline.append({
                    "$project": {
                        "empCode": "$empCode",
                        "empName": "$empName",
                        "dailyRecords": {
                            "$filter": {
                                "input": "$dailyRecords",
                                "as": "record",
                                "cond": {
                                    "$and": [
                                        {"$eq": [{"$year": "$$record.date"}, target_date.year]},
                                        {"$eq": [{"$month": "$$record.date"}, target_date.month]},
                                        {"$eq": [{"$dayOfMonth": "$$record.date"}, target_date.day]}
                                    ]
                                }
                            }
                        }
                    }
                })
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        elif view_type == 'week' and date:
            try:
                target_date = datetime.strptime(date, '%Y-%m-%d')
                start_of_week = target_date - timedelta(days=target_date.weekday()) # Monday
                end_of_week = start_of_week + timedelta(days=6) # Sunday
                pipeline.append({
                    "$project": {
                        "empCode": "$empCode",
                        "empName": "$empName",
                        "dailyRecords": {
                            "$filter": {
                                "input": "$$ROOT.dailyRecords",
                                "as": "record",
                                "cond": {
                                    "$and": [
                                        {"$gte": ["$$record.date", start_of_week]},
                                        {"$lte": ["$$record.date", end_of_week]}
                                    ]
                                }
                            }
                        }
                    }
                })

            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        else:
            raise HTTPException(status_code=400, detail="Invalid query parameters. Must provide 'view_type' ('day', 'week', or 'month') and corresponding date parameters.")

        # Execute the aggregation pipeline
        employee_data = await attendance_collection.aggregate(pipeline).to_list(length=None)
        
        if not employee_data:
            raise HTTPException(status_code=404, detail=f"No attendance data found for employee {employee_code} and the specified period.")

        # Convert ObjectId to string for JSON serialization
        sanitized_data = serialize_document(employee_data[0])
        return sanitized_data # Return the single document

    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Failed to fetch attendance report for user: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch attendance data: {e}")

# --- Manager Report Endpoint ---
async def find_manager_details_by_code(emp_code: str, stc_db):
    """
    Finds a manager's details by searching across all team collections.
    """
    manager = None
    collection_names = await stc_db.list_collection_names()
    team_collections = [stc_db[name] for name in collection_names]
    emp_code_regex = re.compile(f"^{re.escape(emp_code)}$", re.IGNORECASE)

    for collection in team_collections:
        # Search by empCode or Emp code for flexibility
        manager = await collection.find_one({"$or": [{"empCode": emp_code_regex}, {"Emp code": emp_code_regex}]})
        if manager:
            break

    if not manager:
        return {"managerName": None, "managerId": None, "team": []}

    manager_name = manager.get("name") or manager.get("Name", "Unknown Manager")
    manager_designation = (manager.get("designation") or manager.get("Designation", "")).lower().strip()

    team_list = []

    # A user is considered a manager if their designation includes "manager", "director",
    # or if they are a reviewer for someone else.
    is_manager_by_designation = "manager" in manager_designation

    if manager_name:
        for collection in team_collections:
            # Find employees whose 'reviewer' field matches the manager's name
            manager_name_regex = re.compile(f"^{re.escape(manager_name)}$", re.IGNORECASE)
            team_members = await collection.find(
                {"reviewer": manager_name_regex},
                {"_id": 0, "password_hash": 0}
            ).to_list(length=None)

            for emp in team_members:
                # Ensure we don't add duplicates if an employee exists in multiple collections
                emp_email = emp.get("email") or emp.get("Email ID")
                # Use email for uniqueness check
                if emp_email and not any(e.get("email") == emp_email for e in team_list):
                    team_list.append({
                        "Name": emp.get("name") or emp.get("Name"),
                        "empCode": emp.get("empCode") or emp.get("Emp code", ""), # Default to empty string if missing
                        "Designation": emp.get("designation") or emp.get("Designation", ""),
                        "Reviewer": emp.get("reviewer") or emp.get("Reviewer", ""),
                        "email": emp_email # Add email for uniqueness check
                    })

    # If the user is not a manager by designation and has no team members, they are not a manager.
    # Allow users with "director" in their designation to be considered managers even with no direct reports.
    if not is_manager_by_designation and not team_list and "director" not in manager_designation:
        logging.warning(f"User {emp_code} ({manager_name}) is not a manager. Designation: {manager_designation}")
        return {"managerName": None, "managerId": None, "team": []}

    # Also include the manager in their own team list
    manager_id = manager.get("empCode") or manager.get("Emp code")
    if not any(e.get("empCode") == manager_id for e in team_list if e.get("empCode")):
        team_list.insert(0, { # Add manager to the start of the list
            "Name": manager_name,
            "empCode": manager_id or "",
            "Designation": manager_designation,
            "Reviewer": manager.get("reviewer") or manager.get("Reviewer", ""),
            "email": manager.get("email") or manager.get("Email ID")
        })

    return {"managerName": manager_name, "managerId": manager_id, "team": team_list}

@api_router.get("/manager/{manager_code}/team")
async def get_manager_team(manager_code: str):
    try:
        details = await find_manager_details_by_code(manager_code, stc_db)
        if not details["managerName"]:
            raise HTTPException(status_code=404, detail="Manager not found")
        return details
    except Exception as e:
        logging.error(f"Failed to get manager team: {e}")
        raise HTTPException(status_code=500, detail="Failed to get manager team")

class ManagerReportRequest(BaseModel):
    manager_code: str
    team_emp_codes: List[str]
    reportType: str
    year: Optional[int] = None
    month: Optional[int] = None
    date: Optional[str] = None
    endDate: Optional[str] = None

@api_router.post("/attendance-report/manager")
async def get_manager_attendance_report(request: ManagerReportRequest):
    try:
        # The frontend now sends the list of employee codes directly.
        team_employee_codes = request.team_emp_codes
        if not team_employee_codes:
            return {"teamRecords": []} # Return empty if no team members

        coll = attendance_db["Attendance"]
        pipeline = [{"$match": {"empCode": {"$in": team_employee_codes}}}]

        # Day-wise range view
        if request.reportType == "day" and request.date and request.endDate:
            start_date = datetime.fromisoformat(request.date.split('T')[0] + 'T00:00:00.000Z')
            end_date = datetime.fromisoformat(request.endDate.split('T')[0] + 'T23:59:59.999Z')
            pipeline += [
                {"$unwind": "$dailyRecords"},
                {"$match": {
                    "dailyRecords.date": {"$gte": start_date, "$lte": end_date}
                }},
                {
                    "$group": {
                        "_id": "$empCode",
                        "empName": {"$first": "$empName"},
                        "dailyRecords": {"$push": "$dailyRecords"}
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "empCode": "$_id",
                        "empName": 1,
                        "dailyRecords": 1
                    }
                }
            ]

        # Month view
        elif request.reportType == "month" and request.year and request.month:
            start = datetime(request.year, request.month, 1)
            end = (start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            pipeline += [
                {"$unwind": "$dailyRecords"},
                {"$match": {
                    "dailyRecords.date": {
                        "$gte": start.replace(tzinfo=timezone.utc),
                        "$lte": end.replace(tzinfo=timezone.utc)
                    }
                }},
                {
                    "$group": {
                        "_id": "$empCode",
                        "empName": {"$first": "$empName"},
                        "P": {"$sum": {"$cond": [{"$eq": ["$dailyRecords.status", "P"]}, 1, 0]}},
                        "A": {"$sum": {"$cond": [{"$eq": ["$dailyRecords.status", "A"]}, 1, 0]}},
                        "L": {"$sum": {"$cond": {
                                "if": {"$gt": ["$dailyRecords.lateBy", "00:00"]},
                                "then": 1,
                                "else": 0
                            }}},
                        "dailyRecords": {"$push": "$dailyRecords"} # Add this line
                    }
                },
                {
                    "$project": {"_id": 0, "empCode": "$_id", "empName": 1, "P": 1, "A": 1, "L": 1, "dailyRecords": 1}
                },
            ]
        else:
            raise HTTPException(status_code=400, detail="Invalid query parameters. Use reportType=day (with date & endDate) or reportType=month (with year & month).")

        records = await coll.aggregate(pipeline).to_list(length=None)
        return {"teamRecords": records}

    except Exception as e:
        logging.error(f"Manager report failed: {e}")
        raise HTTPException(status_code=500, detail=f"Manager report failed: {e}")

HARDCODED_CHANNELS = [
    {"name": "general", "type": "public", "department": "All", "description": "General company announcements and discussions"},
    {"name": "dept-research", "type": "department", "department": "Research", "description": "Research department discussions"},
    {"name": "dept-media", "type": "department", "department": "Media", "description": "Media department discussions"},
    {"name": "dept-data", "type": "department", "department": "Data", "description": "Data department discussions"},
    {"name": "dept-dmc", "type": "department", "department": "DMC", "description": "DMC department discussions"},
    {"name": "dept-campaign", "type": "department", "department": "Campaign", "description": "Campaign department discussions"},
    {"name": "dept-soul-central", "type": "department", "department": "Soul Central", "description": "Soul Central department discussions"},
    {"name": "dept-directors-team", "type": "department", "department": "Directors team", "description": "Directors team department discussions"},
    {"name": "dept-hr", "type": "department", "department": "HR", "description": "HR department discussions"},
    {"name": "dept-admin", "type": "department", "department": "Admin", "description": "Admin department discussions"},
    {"name": "team-digital-production", "type": "team", "department": "DMC", "subDepartment": "Digital Production", "description": "Digital Production team channel"},
    {"name": "team-digital-communication", "type": "team", "department": "DMC", "subDepartment": "Digital Communication", "description": "Digital Communication team channel"},
    {"name": "team-propagation", "type": "team", "department": "DMC", "subDepartment": "Propagation", "description": "Propagation team channel"},
    {"name": "team-neagitive-propagation", "type": "team", "department": "DMC", "subDepartment": "Neagitive Propagation", "description": "Neagitive Propagation team channel"},
    {"name": "team-digital-marketing/networking", "type": "team", "department": "DMC", "subDepartment": "Digital Marketing/Networking", "description": "Digital Marketing/Networking team channel"},
    {"name": "team-hive", "type": "team", "department": "DMC", "subDepartment": "HIVE", "description": "HIVE team channel"},
    {"name": "team-field-team-ap-1", "type": "team", "department": "Soul Central", "subDepartment": "Field Team AP-1", "description": "Field Team AP-1 team channel"},
    {"name": "team-field-team-ap-2", "type": "team", "department": "Soul Central", "subDepartment": "Field Team AP-2", "description": "Field Team AP-2 team channel"},
    {"name": "team-field-team-tg", "type": "team", "department": "Soul Central", "subDepartment": "Field Team TG", "description": "Field Team TG team channel"},
    {"name": "team-pmu", "type": "team", "department": "Soul Central", "subDepartment": "PMU", "description": "PMU team channel"},
    {"name": "team-directors-team-1", "type": "team", "department": "Directors team", "subDepartment": "Directors Team-1", "description": "Directors Team-1 team channel"},
    {"name": "team-directors-team-2", "type": "team", "department": "Directors team", "subDepartment": "Directors Team-2", "description": "Directors Team-2 team channel"},
    {"name": "team-directors-team-3", "type": "team", "department": "Directors team", "subDepartment": "Directors Team-3", "description": "Directors Team-3 team channel"},
    {"name": "team-operations", "type": "team", "department": "Admin", "subDepartment": "Operations", "description": "Operations team channel"},
    {"name": "team-system-admin", "type": "team", "department": "Admin", "subDepartment": "System Admin", "description": "System Admin team channel"}
]


@api_router.get("/channels")
async def get_channels(user_id: Optional[str] = None):
    """
    Get channels. If user_id is provided, it filters channels the user has access to.
    Otherwise, it returns all channels.
    """
    all_channels = []
    for i, channel_data in enumerate(HARDCODED_CHANNELS):
        members = await manager.get_channel_members(channel_data["name"], stc_db)
        channel_info = {
            "id": i + 1,
            "name": channel_data["name"],
            "type": channel_data["type"],
            "department": channel_data.get("department"),
            "subDepartment": channel_data.get("subDepartment"),
            "memberCount": len(members),
            "description": channel_data["description"],
            "lastActivity": datetime.now(ist_tz).isoformat()
        }
        all_channels.append(channel_info)

    if not user_id:
        return all_channels
    else: # Filter for a specific user
        # Filter channels based on user department and team
        user = await get_user_info(stc_db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user_dept = user.get('department')
        user_team = user.get('team')
        user_channels = []

        for channel in all_channels:
            # User is in 'general' channel
            if channel['name'] == 'general':
                user_channels.append(channel)
            # User is in their department channel
            elif channel['type'] == 'department' and channel['department'] == user_dept:
                user_channels.append(channel)
            # User is in their team channel
            elif channel['type'] == 'team' and channel['subDepartment'] == user_team:
                user_channels.append(channel)

        logging.info(f"Filtered channels for user {user_id}: {len(user_channels)} channels")
        return user_channels

@api_router.get("/announcements", response_model=List[Dict])
async def get_announcements():
    """
    Fetch all published announcements from the database. This is accessible to all users.
    """
    try:
        announcements = await chat_db.Announcements.find({"status": "published"}).sort("date", -1).to_list(length=None)
        return serialize_document(announcements)
    except Exception as e:
        logging.error(f"Error fetching announcements: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch announcements.")

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    priority: str
    scheduled_at: Optional[datetime] = None

@api_router.post("/announcements", response_model=Announcement)
async def create_announcement(
    announcement_data: AnnouncementCreate,
    admin_user: dict = Depends(get_current_admin_user)
):
    """
    (Admin Only) Create a new announcement.
    """
    try:
        announcement = Announcement(
            title=announcement_data.title,
            content=announcement_data.content,
            priority=announcement_data.priority,
            author=admin_user.get("name", "Admin"),
            scheduled_at=announcement_data.scheduled_at
        )

        # The frontend sends a UTC datetime, so we can use it directly.

        if announcement.scheduled_at and announcement.scheduled_at > datetime.now(timezone.utc):
            announcement.status = "scheduled"
            logging.info(f"Admin '{admin_user.get('email')}' scheduled announcement for {announcement.scheduled_at}")
        else:

            # If not scheduled or scheduled for the past, publish immediately.
            announcement.status = "published"
            announcement.scheduled_at = None # Clear scheduled time if published now

        await chat_db.Announcements.insert_one(announcement.model_dump())

        # Only broadcast and create notifications if the announcement is published immediately.
        if announcement.status == "published":
            logging.info(f"Admin '{admin_user.get('email')}' published announcement: '{announcement.title}'")

            # --- Create notifications for offline users ---
            all_employee_emails = await get_all_employees_emails(stc_db)
            offline_users = [email for email in all_employee_emails if email not in manager.active_connections and email != admin_user.get("email")]

            if offline_users:
                notifications_to_create = [
                    Notification(
                        user_id=user_id,
                        sender_id=admin_user.get("email", "admin"),
                        sender_name=announcement.author,
                        message_id=announcement.id,
                        message_content=announcement.title,
                        type="announcement"
                    ).model_dump() for user_id in offline_users
                ]
                await chat_db.Notifications.insert_many(notifications_to_create)
                logging.info(f"Created {len(notifications_to_create)} offline notifications for new announcement.")

            # Broadcast the new announcement to all connected clients
            broadcast_payload = {
                "type": "new_announcement",
                "data": serialize_document(announcement.model_dump())
            }
            await manager.broadcast(json.dumps(broadcast_payload))

        return announcement
    except Exception as e:
        logging.error(f"Error creating announcement: {e}")
        raise HTTPException(status_code=500, detail="Failed to create announcement.")

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    priority: Optional[str] = None
    scheduled_at: Optional[datetime] = None

@api_router.put("/announcements/{announcement_id}", response_model=Announcement)
async def update_announcement(
    announcement_id: str,
    announcement_data: AnnouncementUpdate,
    admin_user: dict = Depends(get_current_admin_user)
):
    """
    (Admin Only) Update an existing announcement.
    """
    try:
        update_payload = announcement_data.model_dump(exclude_unset=True)

        # Handle scheduling logic
        if 'scheduled_at' in update_payload:
            scheduled_time = update_payload['scheduled_at']
            if scheduled_time and scheduled_time > datetime.now(timezone.utc):
                update_payload['status'] = 'scheduled'
            else:
                update_payload['status'] = 'published'
                update_payload['date'] = datetime.now(timezone.utc) # Set publish date to now
                update_payload['scheduled_at'] = None # Clear schedule time

        if not update_payload:
            raise HTTPException(status_code=400, detail="No update data provided.")

        result = await chat_db.Announcements.update_one(
            {"id": announcement_id},
            {"$set": update_payload}
        )

        if result.modified_count == 0:
            if not await chat_db.Announcements.find_one({"id": announcement_id}):
                 raise HTTPException(status_code=404, detail="Announcement not found.")

        updated_announcement = await chat_db.Announcements.find_one({"id": announcement_id})
        return updated_announcement
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating announcement {announcement_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update announcement.")

@api_router.delete("/announcements/{announcement_id}", status_code=204)
async def delete_announcement(announcement_id: str, admin_user: dict = Depends(get_current_admin_user)):
    """
    (Admin Only) Delete an announcement by its _id.
    """
    try:
        # The frontend sends the UUID 'id' field, not the BSON '_id'
        result = await chat_db.Announcements.delete_one({"id": announcement_id})
    except Exception as e:
        logging.error(f"Error deleting announcement {announcement_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete announcement.")

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    logging.info(f"Admin '{admin_user.get('email')}' deleted announcement with _id: {announcement_id}")


async def handle_reaction_update(message_data, client_id):
    """Handle reaction updates for messages"""
    try:
        message_id = message_data.get("message_id")
        reaction_type = message_data.get("reaction_type")
        action = message_data.get("action")  # "add" or "remove"

        if not message_id or not reaction_type or action not in ["add", "remove"]:
            logging.error(f"Invalid reaction update data: {message_data}")
            return

        # Determine collection based on message type (channel or direct)
        # First, try to find the message in Channel_chat
        message = await chat_db.Channel_chat.find_one({"id": message_id})
        collection = chat_db.Channel_chat
        if not message:
            # If not found in Channel_chat, try Direct_chat
            message = await chat_db.Direct_chat.find_one({"id": message_id})
            collection = chat_db.Direct_chat

        if not message:
            logging.error(f"Message {message_id} not found")
            return

        # Update the reactions field
        reactions = message.get("reactions", [])
        user_reaction = {"user_id": client_id, "reaction_type": reaction_type}

        if action == "add":
            # Check if user already reacted with this type
            existing_reaction = next((r for r in reactions if r["user_id"] == client_id and r["reaction_type"] == reaction_type), None)
            if not existing_reaction:
                reactions.append(user_reaction)
        elif action == "remove":
            # Remove the user's reaction of this type
            reactions = [r for r in reactions if not (r["user_id"] == client_id and r["reaction_type"] == reaction_type)]

        # Update the message in the database
        await collection.update_one(
            {"id": message_id},
            {"$set": {"reactions": reactions}}
        )

        # Broadcast the reaction update to all relevant users
        reaction_update_json = json.dumps({
            "type": "reaction_update",
            "message_id": message_id,
            "reactions": reactions,
            "updated_by": client_id
        })

        if message.get("channel_id"):
            # Broadcast to channel members
            await manager.broadcast_to_channel(reaction_update_json, message["channel_id"], stc_db)
        elif message.get("recipient_id"):
            # Send to both sender and recipient
            await manager.send_personal_message(reaction_update_json, message["sender_id"])
            await manager.send_personal_message(reaction_update_json, message["recipient_id"])

        logging.info(f"Reaction update handled for message {message_id} by {client_id}")

    except Exception as e:
        logging.error(f"Failed to handle reaction update: {e}")

# WebSocket endpoint
@api_router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            # logging.info(f"Received JSON from {client_id}: {message_data}")

            # Handle ping messages
            if message_data.get("type") == "ping":
                continue

            # Handle internal status requests without saving them as messages
            if message_data.get("type") == "get_all_statuses":
                # This is a request from the client, not a message to be stored or broadcasted
                continue

            # Handle reaction updates
            if message_data.get("type") == "reaction_update":
                await handle_reaction_update(message_data, client_id)
                continue

            # Handle set_status messages
            if message_data.get("type") == "set_status":
                user_id = message_data.get("user_id")
                status = message_data.get("status")
                if user_id and status:
                    manager.user_status[user_id] = status
                    await manager.broadcast_status(user_id, status)
                    logging.info(f"User {user_id} status updated to {status}")
                continue

            # Convert recipient_id and channel_id to string if present
            if 'recipient_id' in message_data:
                message_data['recipient_id'] = str(message_data['recipient_id'])
            if 'channel_id' in message_data:
                message_data['channel_id'] = str(message_data['channel_id'])

            # --- Message Type Determination ---
            recipient_id = message_data.get("recipient_id")
            channel_id = message_data.get("channel_id")
            message_type_from_client = message_data.get("type")
            
            # Determine if it's a channel message
            is_channel_message = False
            if channel_id: # Explicit channel_id is always a channel message
                is_channel_message = True
            elif recipient_id and (recipient_id == 'general' or recipient_id.startswith('dept-') or recipient_id.startswith('team-')):
                is_channel_message = True # recipient_id is a channel name
            
            if is_channel_message:
                msg_type = "channel_message"
            else:
                msg_type = "personal_message"

            message = Message(
                sender_id=client_id,
                sender_name=message_data.get("sender_name", client_id),
                content=message_data.get("content", ""),
                channel_id=channel_id if channel_id else (recipient_id if msg_type == "channel_message" else None),
                recipient_id=message_data.get("recipient_id"),
                # New file message fields
                file_name=message_data.get("file_name"),
                file_type=message_data.get("file_type"),
                file_size=message_data.get("file_size"),
                file_url=message_data.get("file_url"),
                type=msg_type
            )

            # Create message_json for notifications
            def default_serializer(o):
                if isinstance(o, (datetime, date)):
                    return o.isoformat()
                raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")

            message_json = json.dumps({
                "type": msg_type, # Use the determined message type
                "sender_id": message.sender_id,
                "sender_name": message.sender_name,
                "content": message.content,
                "id": message.id,
                "timestamp": message.timestamp,
                "recipient_id": message.channel_id if msg_type == "channel_message" else message.recipient_id,
                "channel_id": message.channel_id,
                "file_name": message.file_name,
                "file_type": message.file_type,
                "file_size": message.file_size,
                "file_url": message.file_url,
                "reactions": message.reactions,
            }, default=default_serializer)

            # Create notifications for offline channel members if it's a channel message
            if msg_type == "channel_message":
                await manager.create_channel_notifications(message_json, message.channel_id, client_id, stc_db, chat_db)

            # Try to store the message in the database, but don't fail if DB is unavailable
            try:
                message_dict = message.model_dump()
                logging.info(f"Attempting to store message in database: {message_dict}")

                # Determine collection based on message type
                if msg_type == "channel_message":
                    # Channel message: store in Channel_chat (includes channel messages and files)
                    result = await chat_db.Channel_chat.insert_one(message_dict)
                    logging.info(f"Channel message stored in Channel_chat for {client_id}, inserted_id: {result.inserted_id}")
                elif message.type == "personal_message":
                    # Direct message: store in Direct_chat (includes direct messages and files)
                    result = await chat_db.Direct_chat.insert_one(message_dict)
                    logging.info(f"Direct message stored in Direct_chat for {client_id}, inserted_id: {result.inserted_id}")
            except Exception as db_error:
                logging.error(f"Could not store message in database for {client_id}: {db_error}. Continuing with WebSocket functionality.")

            # Send message based on type
            if msg_type == "channel_message":
                # Broadcast to channel members, excluding the sender.
                await manager.broadcast_to_channel(message_json, message.channel_id, stc_db, sender_id=client_id)
                # The sender's client will handle the message via an optimistic update, so no echo is needed here.
            elif isinstance(message.recipient_id, list):
                # Group message: send to all recipients in the list
                for recipient in message.recipient_id:
                    if recipient in manager.active_connections:
                        await manager.send_personal_message(message_json, recipient)
                # Also send back to the sender
                await manager.send_personal_message(message_json, message.sender_id)
            elif message.type == "personal_message" and message.recipient_id:
                # Send to the recipient. The manager will create a notification if offline.
                await manager.send_personal_message(message_json, message.recipient_id)

                # Send a confirmation back to the sender with the final message ID and timestamp.
                # This allows the client to replace the optimistic message without triggering a self-notification.
                confirmation_data = {
                    "type": "message_confirmation",
                    "optimistic_id": message_data.get("id"), # The temporary ID from the client
                    "final_id": message.id,
                    "timestamp": message.timestamp.isoformat()
                }
                await websocket.send_text(json.dumps(confirmation_data))
            else:
                logging.warning(f"Message from {client_id} could not be routed: {message_json}")

    except WebSocketDisconnect:
        logging.info(f"WebSocketDisconnect for user {client_id}")
        # Removed await websocket.close() to avoid double close error
    except Exception as e:
        logging.error(f"Unexpected error for user {client_id}: {e}")
    finally:
        await manager.disconnect(websocket, client_id)
        logging.info(f"User {client_id} connection handler finished.")

# Corrected CORS middleware configuration
@app.get("/")
async def app_root():
    """A simple endpoint for the root URL to confirm the server is running."""
    return {"message": "Welcome to the STC Portal API. Visit /docs for documentation."}

# Include the download file router and provide the GridFS dependency
api_router.include_router(
    download_router, dependencies=[Depends(get_grid_fs)]
)
app.include_router(api_router) # Include the main api_router in the app

# Mount static files for uploads
# from fastapi.staticfiles import StaticFiles
# app.mount("/uploads", StaticFiles(directory=str(ROOT_DIR / "uploads")), name="uploads") # This is no longer needed

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    try:
        await main_client.admin.command('ping')
        await attendance_client.admin.command('ping')
        logger.info("MongoDB connections successful.")
        # Start the background task for checking scheduled announcements
        asyncio.create_task(check_scheduled_announcements())
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        logger.info("Continuing without MongoDB - WebSocket functionality will work without database persistence")
        
app.include_router(api_router)
