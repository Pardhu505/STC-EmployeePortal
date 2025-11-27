from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Iterable
from datetime import datetime
import os
import asyncio

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build, Resource
from googleapiclient.errors import HttpError
from models import Employee, get_current_admin_user
router = APIRouter() # --- Configuration ---

# --- Configuration ---
# Ensure these are in your environment variables
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
]

class OrderInsensitiveFlow(Flow):
    """
    A custom Flow class that overrides the fetch_token method to perform
    an order-insensitive comparison of scopes. This prevents "Scope has changed"
    errors when the frontend and backend list scopes in a different order.
    """
    def fetch_token(self, **kwargs):
        # The library might provide the scope as a list or a space-separated string.
        # We normalize it to a sorted space-separated string for consistent comparison.
        if self.oauth2session.scope:
            self.oauth2session.scope = " ".join(sorted(self.oauth2session.scope))
        
        authorization_response = kwargs.get("authorization_response")
        if authorization_response:
            auth_resp_scope = authorization_response.get("scope", "") or "" # The scope from Google is a string
            authorization_response["scope"] = " ".join(sorted(auth_resp_scope.split()))
        return super().fetch_token(**kwargs)

class MeetingDetails(BaseModel):
    summary: str
    description: Optional[str] = ""
    start_datetime: datetime = Field(..., alias="startDateTime")
    end_datetime: datetime = Field(..., alias="endDateTime")
    attendees: List[EmailStr] = []

class ScheduleMeetingRequest(BaseModel):
    auth_code: str = Field(..., alias="authCode")
    meeting_details: MeetingDetails = Field(..., alias="meetingDetails")


@router.post("/schedule", status_code=201)
async def schedule_meeting(
    request_data: ScheduleMeetingRequest,
    current_user: Employee = Depends(get_current_admin_user)
):
    """
    Schedules a new meeting in the user's Google Calendar.
    The frontend must provide an authorization code from Google's OAuth flow.
    """
    flow = OrderInsensitiveFlow.from_client_config(
        client_config={
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI
    )

    try:
        # Exchange the authorization code for credentials.
        # Our custom flow will handle scope order mismatches.
        flow.fetch_token(code=request_data.auth_code, allow_credentials_in_request_body=True)
        credentials = flow.credentials

        # You should securely store credentials.to_json() for the user in your database
        # to avoid asking for permission every time. For this example, we proceed directly.
        # Example: await db.users.update_one({"email": current_user.email}, {"$set": {"google_creds": credentials.to_json()}})
        
        service: Resource = await asyncio.to_thread(build, 'calendar', 'v3', credentials=credentials)

        meeting = request_data.meeting_details
        event = {
            'summary': meeting.summary,
            'description': meeting.description,
            'start': {
                'dateTime': meeting.start_datetime.isoformat(),
                'timeZone': 'Asia/Kolkata', # Or detect from client
            },
            'end': {
                'dateTime': meeting.end_datetime.isoformat(),
                'timeZone': 'Asia/Kolkata',
            },
            'attendees': [{'email': attendee} for attendee in meeting.attendees],
            'conferenceData': {
                'createRequest': {
                    'requestId': f"stc-portal-{datetime.now().timestamp()}",
                    'conferenceSolutionKey': {'type': 'hangoutsMeet'}
                }
            },
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},
                    {'method': 'popup', 'minutes': 30},
                ],
            },
        }

        created_event = await asyncio.to_thread(
            service.events().insert( # type: ignore
                calendarId='primary',
                body=event,
                conferenceDataVersion=1,
                sendNotifications=True
            ).execute 
        )

        return {"message": "Meeting scheduled successfully!", "event_link": created_event.get('htmlLink')}

    except HttpError as error:
        print(f"An error occurred: {error}")
        raise HTTPException(status_code=400, detail=f"Failed to create calendar event: {error}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred while scheduling the meeting.")