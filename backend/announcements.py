import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from chat import manager
from database import chat_db, stc_db, get_all_employees_emails
from models import serialize_document, get_current_admin_user, Notification, ist_tz
import urllib.parse

router = APIRouter()
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
    scheduled_at: Optional[datetime] = None
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
@router.get("/announcements", response_model=List[Dict])
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

@router.post("/announcements", response_model=Announcement)
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
            scheduled_at=announcement_data.scheduled_at,
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

@router.put("/announcements/{announcement_id}", response_model=Announcement)
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

@router.delete("/announcements/{announcement_id}", status_code=204)
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
