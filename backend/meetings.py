from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field, EmailStr, validator
from typing import List, Optional
from datetime import datetime
import os
import re

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.exceptions import RefreshError
from googleapiclient.errors import HttpError
 
# Import the admin user dependency from models.py, which handles token validation.
from models import get_current_user, Employee
from database import stc_db, get_employee_by_name
 
router = APIRouter()

# --- Configuration ---
# Ensure these are in your environment variables
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

# The frontend library (@react-oauth/google) adds these scopes by default.
# The backend Flow must be aware of all scopes being requested to avoid a ScopeChangedError.
SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
]

class MeetingDetails(BaseModel):
    summary: str
    description: Optional[str] = ""
    start_datetime: datetime = Field(..., alias="startDateTime")
    end_datetime: datetime = Field(..., alias="endDateTime")
    attendees: List[str] = [] # Can be names or emails

class ScheduleMeetingRequest(BaseModel):
    auth_code: str = Field(..., alias="authCode")
    meeting_details: MeetingDetails = Field(..., alias="meetingDetails")


@router.post("/schedule", status_code=201)
async def schedule_meeting(
    request_data: ScheduleMeetingRequest,
    # use_cache=False tells FastAPI to NOT run this dependency for OPTIONS requests.
    # This prevents the auth check during the CORS preflight, fixing the root cause.
    current_user: Employee = Depends(get_current_user) # We will adjust the dependency itself
):
    """
    Schedules a new meeting in the user's Google Calendar.
    The frontend must provide an authorization code from Google's OAuth flow.
    """
    try:
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

        meeting = request_data.meeting_details
        resolved_attendees = []
        unresolved_attendees = []

        for attendee in meeting.attendees:
            # Simple check for email format
            if re.match(r"[^@]+@[^@]+\.[^@]+", attendee):
                resolved_attendees.append(attendee)
            else:
                # Assume it's a name and look up the email
                employee = await get_employee_by_name(stc_db, attendee)
                if employee and employee.get("email"):
                    resolved_attendees.append(employee["email"])
                else:
                    unresolved_attendees.append(attendee)

        # Exchange the authorization code for credentials (access and refresh tokens)
        flow.fetch_token(code=request_data.auth_code)
        credentials = flow.credentials

        # You should securely store credentials.to_json() for the user in your database
        # to avoid asking for permission every time. For this example, we proceed directly.
        # Example: await db.users.update_one({"email": current_user.email}, {"$set": {"google_creds": credentials.to_json()}})

        service = build('calendar', 'v3', credentials=credentials)

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
            'attendees': [{'email': email} for email in resolved_attendees],
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

        response_message = "Meeting scheduled successfully!"
        if unresolved_attendees:
            response_message += f" Could not find emails for: {', '.join(unresolved_attendees)}."

        return {"message": response_message, "event_link": created_event.get('htmlLink')}

    except RefreshError as error:
        # This specifically catches errors from an invalid, expired, or already-used auth_code.
        # This is a client-side error, so we return a 400 Bad Request.
        print(f"Google Auth RefreshError during token fetch: {error}")
        raise HTTPException(status_code=400, detail=f"Invalid authorization code provided. It may be expired or has already been used. Please try again. Details: {error}")

    except HttpError as error:
        print(f"An error occurred: {error}")
        raise HTTPException(status_code=400, detail=f"Failed to create calendar event: {error}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred while scheduling the meeting.")