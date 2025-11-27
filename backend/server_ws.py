import json
import logging
import asyncio
import re
import uuid
import urllib.parse
from datetime import datetime, timezone, timedelta, date
from typing import List, Dict, Union, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Query, Request, File, UploadFile
from bson import ObjectId

from database import chat_db, stc_db, get_all_employees_emails, get_employees_by_department, sanitize_team
from models import (
    Message, DeletedMessage, Notification, Announcement, AnnouncementCreate, AnnouncementUpdate, UserProfileUpdate,
    MarkReadRequest, get_user_info, get_user_info_with_collection, get_current_admin_user, serialize_document,
    TEAMS, DEPARTMENT_TEAMS, get_department_from_team
) 

router = APIRouter()
ist_tz = timezone(timedelta(hours=5, minutes=30))

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
                # Add team channel, ensuring slashes are preserved if they are part of the name
                team_slug = user["team"].lower().replace(' ', '-')
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

class StatusCheckCreate(Message):
    client_name: str
    status: str

@router.get("/users/status", response_model=List[Dict])
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

@router.post("/users/{user_id}/status", response_model=Dict)
async def set_user_status_api(user_id: str, status_update: StatusCheckCreate):
    if status_update.client_name != user_id:
        raise HTTPException(status_code=400, detail="User ID in path and body must match.")

    new_status = status_update.status.lower()
    if new_status not in ["online", "offline", "busy"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'online', 'offline', or 'busy'.")

    manager.user_status[user_id] = new_status
    await manager.broadcast_status(user_id, new_status)
    return {"user_id": user_id, "status": new_status}
@router.get("/messages")
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

@router.get("/channel-messages")
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

@router.get("/direct-messages")
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

@router.delete("/messages")
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

@router.post("/direct-messages/clear-for-user")
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


@router.post("/channel-messages/clear-for-user")
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


@router.post("/messages/{message_id}/delete")
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

@router.delete("/messages/{message_id}")
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
# In server.py

@router.post("/messages/{message_id}/delete-everyone")
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


# File upload endpoint
@router.post("/files/upload")
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

async def get_user_channels(self, user_id: str, db) -> List[str]:
        channels = ["general"]
        user = await get_user_info(db, user_id)
        if user and user.get("team"):
            dept = get_department_from_team(user["team"])
            if dept:
                channels.append(f"dept-{dept.lower().replace(' ', '-').replace('/', '-')}")
            channels.append(f"team-{user['team'].lower().replace(' ', '-').replace('/', '-')}")
        return channels

async def get_channel_members(self, channel_id: str, db) -> List[str]:
        """
        Resolves channel membership:
        - 'general' => all employees
        - 'dept-...' => employees of that department
        - 'team-...' => team collection members
        """
        if channel_id == 'general':
            return await get_all_employees_emails(db)
        elif channel_id.startswith('dept-'):
            dept_name_raw = channel_id.replace('dept-', '').replace('-', ' ')
            dept_name_found = next((dept for dept in DEPARTMENT_TEAMS if dept.lower().replace(' ', '-') == dept_name_raw), None)
            return await get_employees_by_department(db, dept_name_found) if dept_name_found else []
        elif channel_id.startswith('team-'):
            team_slug = channel_id.replace('team-', '')
            team_name = next((team for team in TEAMS if team.lower().replace(' ', '-').replace('/', '-') == team_slug), None)
            if team_name:
                collection_name = sanitize_team(team_name)
                collection = db[collection_name]
                users = await collection.find({}, {"email": 1, "_id": 0}).to_list(None)
                return [u['email'] for u in users]
        return []
@router.get("/channels")
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
@router.websocket("/ws/{client_id}")
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