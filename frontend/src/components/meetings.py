from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime
import os

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from ..auth import get_current_user # Assuming you have this for user auth
from ..database import User # Assuming a user model

router = APener()

# --- Configuration ---
# Ensure these are in your environment variables
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

SCOPES = ['https://www.googleapis.com/auth/calendar.events']

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
    current_user: User = Depends(get_current_user)
):
    """
    Schedules a new meeting in the user's Google Calendar.
    The frontend must provide an authorization code from Google's OAuth flow.
    """
    flow = Flow.from_client_config(
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
        # Exchange the authorization code for credentials (access and refresh tokens)
        flow.fetch_token(code=request_data.auth_code)
        credentials = flow.credentials

        # You should securely store credentials.to_json() for the user in your database
        # to avoid asking for permission every time. For this example, we proceed directly.
        # Example: await db.users.update_one({"email": current_user.email}, {"$set": {"google_creds": credentials.to_json()}})

        service = build('calendar', 'v3', credentials=credentials)

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

        created_event = service.events().insert(
            calendarId='primary',
            body=event,
            conferenceDataVersion=1,
            sendNotifications=True
        ).execute()

        return {"message": "Meeting scheduled successfully!", "event_link": created_event.get('htmlLink')}

    except HttpError as error:
        print(f"An error occurred: {error}")
        raise HTTPException(status_code=400, detail=f"Failed to create calendar event: {error}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred while scheduling the meeting.")