import React, { useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useToast } from '../hooks/use-toast';
import { Video, Loader2, Send, LogIn } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

// --- IMPORTANT ---
// You must create a .env file in your frontend's root directory and add your Google API credentials.
// REACT_APP_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

const MeetingsContent = () => {
  const { user } = useAuth(); // Get portal user
  const { toast } = useToast();
  const [isScheduling, setIsScheduling] = useState(false);
  const [meetingDetails, setMeetingDetails] = useState({
    summary: '',
    description: '',
    startDateTime: '',
    endDateTime: '',
    attendees: '',
  });

  const handleScheduleMeeting = async (authCode) => {
    if (!meetingDetails.summary || !meetingDetails.startDateTime || !meetingDetails.endDateTime) {
      toast({ title: "Missing Fields", description: "Please provide a title and start/end times.", variant: "destructive" });
      return;
    }

    setIsScheduling(true);

    const attendeesFromInput = meetingDetails.attendees
      .split(',')
      .map(email => email.trim())
      .filter(email => email);

    // Use a Set to automatically handle duplicates and ensure the logged-in user is always an attendee.
    const attendeesSet = new Set(attendeesFromInput);
    if (user?.email) {
      attendeesSet.add(user.email);
    }

    const payload = {
      authCode: authCode,
      meetingDetails: {
        summary: meetingDetails.summary,
        description: meetingDetails.description,
        startDateTime: new Date(meetingDetails.startDateTime).toISOString(),
        endDateTime: new Date(meetingDetails.endDateTime).toISOString(),
        attendees: Array.from(attendeesSet),
      }
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/meetings/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Assuming your backend needs the portal's auth token
          'Authorization': `Bearer ${btoa(JSON.stringify(user))}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Failed to schedule meeting.");
      }

      toast({
        title: "Meeting Scheduled!",
        description: "The meeting has been added to your Google Calendar."
      });
      setMeetingDetails({ summary: '', description: '', startDateTime: '', endDateTime: '', attendees: '' });

    } catch (error) {
      console.error("Error scheduling meeting:", error);
      toast({
        title: "Scheduling Failed",
        description: error.message || "Could not schedule the meeting.",
        variant: "destructive"
      });
    } finally {
      setIsScheduling(false);
    }
  };

  const login = useGoogleLogin({
    onSuccess: tokenResponse => {
      // The 'code' is the authorization code we need to send to the backend
      handleScheduleMeeting(tokenResponse.code);
    },
    onError: errorResponse => {
      console.error('Google Login Error:', errorResponse);
      toast({ title: "Google Auth Failed", description: "Could not get authorization from Google.", variant: "destructive" });
      setIsScheduling(false); // Stop loading state on error
    },
    // This is the crucial part for the backend flow
    flow: 'auth-code',
    // The library adds openid, email, profile by default. We must also request the calendar scope.
    // The backend will handle the combined list.
    scope: 'https://www.googleapis.com/auth/calendar.events'
  });

  const handleInitiateSchedule = () => {
    if (!meetingDetails.summary || !meetingDetails.startDateTime || !meetingDetails.endDateTime) {
      toast({ title: "Missing Fields", description: "Please fill out the meeting details before scheduling.", variant: "destructive" });
      return;
    }
    setIsScheduling(true);
    login(); // This will trigger the Google login popup
  };

  const handleInputChange = (field, value) => {
    setMeetingDetails(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Video className="h-6 w-6 mr-2 text-[#225F8B]" />
          Schedule a Meeting
        </h2>
      </div>

      <Card className="bg-white/80 backdrop-blur-sm border-0">
        <CardHeader>
          <CardTitle>New Meeting Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="summary">Meeting Title</Label>
            <Input id="summary" placeholder="e.g., Project Kick-off" value={meetingDetails.summary} onChange={e => handleInputChange('summary', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDateTime">Start Time</Label>
              <Input id="startDateTime" type="datetime-local" value={meetingDetails.startDateTime} onChange={e => handleInputChange('startDateTime', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDateTime">End Time</Label>
              <Input id="endDateTime" type="datetime-local" value={meetingDetails.endDateTime} onChange={e => handleInputChange('endDateTime', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="attendees">Attendees (comma-separated emails)</Label>
            <Input id="attendees" placeholder="user1@example.com, user2@example.com" value={meetingDetails.attendees} onChange={e => handleInputChange('attendees', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Meeting agenda, notes, etc." value={meetingDetails.description} onChange={e => handleInputChange('description', e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleInitiateSchedule} disabled={isScheduling}>
              {isScheduling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Authorizing...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Authorize & Schedule
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 text-right pt-2">
            You will be prompted to sign in with Google to confirm.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const Meetings = () => {
  if (!CLIENT_ID) {
    return <div className="text-red-500 text-center p-4">Google Client ID is not configured. Please set REACT_APP_GOOGLE_CLIENT_ID in your .env file.</div>;
  }
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <MeetingsContent />
    </GoogleOAuthProvider>
  );
};

export default Meetings;