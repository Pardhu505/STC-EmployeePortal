import React, { useState, useRef } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useToast } from "../hooks/use-toast";
import { Video, Loader2, LogIn, X, UserPlus } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAttendees, setSelectedAttendees] = useState([]);
  const debounceTimeout = useRef(null);

  const [meetingDetails, setMeetingDetails] = useState({
    summary: '',
    description: '',
    startDateTime: '',
    endDateTime: '',
  });

  // Add the current user to attendees by default when component mounts
  React.useEffect(() => {
    if (user && user.email) {
      setSelectedAttendees([{ name: user.name, email: user.email }]);
    }
  }, [user]);

  const handleScheduleMeeting = async (authCode) => {
    if (!meetingDetails.summary || !meetingDetails.startDateTime || !meetingDetails.endDateTime) {
      toast({ title: "Missing Fields", description: "Please provide a title and start/end times.", variant: "destructive" });
      return;
    }

    setIsScheduling(true);

    // Extract emails from the selected attendees
    const attendeeEmails = selectedAttendees.map(attendee => attendee.email);

    const payload = {
      authCode: authCode,
      meetingDetails: {
        summary: meetingDetails.summary,
        description: meetingDetails.description,
        startDateTime: new Date(meetingDetails.startDateTime).toISOString(),
        endDateTime: new Date(meetingDetails.endDateTime).toISOString(),
        attendees: attendeeEmails,
      }
    };
    const token = btoa(JSON.stringify({ email: user.email }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/meetings/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Assuming your backend needs the portal's auth token
           "Authorization": `Bearer ${token}`

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
      // Reset form state
      setMeetingDetails({ summary: '', description: '', startDateTime: '', endDateTime: '' });
      setSearchQuery('');
      setSearchResults([]);
      // Reset attendees to just the logged-in user
      if (user && user.email) {
        setSelectedAttendees([{ name: user.name, email: user.email }]);
      }

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

  const handleAttendeeSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (!query) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    debounceTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/employees/search?query=${query}`);
        if (response.ok) {
          const data = await response.json();
          // Filter out already selected attendees
          const selectedEmails = new Set(selectedAttendees.map(a => a.email));
          setSearchResults(data.filter(employee => !selectedEmails.has(employee.email)));
        }
      } catch (error) {
        console.error("Failed to search for employees:", error);
        toast({ title: "Search Error", description: "Could not fetch employee suggestions.", variant: "destructive" });
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce delay
  };

  const addAttendee = (employee) => {
    // Prevent adding duplicates
    if (!selectedAttendees.some(a => a.email === employee.email)) {
      setSelectedAttendees(prev => [...prev, { name: employee.name || employee.Name, email: employee.email }]);
    }
    // Clear search
    setSearchQuery('');
    setSearchResults([]);
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
            <Label htmlFor="attendees">Attendees</Label>
            <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-background min-h-[40px]">
              {selectedAttendees.map((attendee) => (
                <div key={attendee.email} className="flex items-center gap-2 bg-muted text-muted-foreground rounded-full px-3 py-1 text-sm">
                  {attendee.name}
                  {/* Don't allow removing the current user */}
                  {attendee.email !== user.email && (
                    <button
                      type="button"
                      onClick={() => setSelectedAttendees(prev => prev.filter(a => a.email !== attendee.email))}
                      className="rounded-full hover:bg-destructive/20"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="relative">
              <div className="relative">
                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="attendees-search"
                  placeholder="Search for employees by name..."
                  value={searchQuery}
                  onChange={handleAttendeeSearch}
                  className="pl-9"
                />
                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
              </div>
              {searchResults.length > 0 && (
                <Card className="absolute z-10 w-full mt-1 shadow-lg">
                  <CardContent className="p-2">
                    <ul className="space-y-1">
                      {searchResults.map((employee) => (
                        <li key={employee.email}>
                          <button
                            type="button"
                            onClick={() => addAttendee(employee)}
                            className="w-full text-left p-2 rounded-md hover:bg-accent"
                          >
                            <p className="font-medium">{employee.name || employee.Name}</p>
                            <p className="text-sm text-muted-foreground">{employee.email}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
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
    return (
      <div className="p-4">
        <Card className="border-red-500 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Configuration Error</CardTitle>
          </CardHeader>
          <CardContent className="text-red-600 space-y-2">
            <p>The Google Client ID is missing. The meeting scheduling feature cannot be initialized.</p>
            <p className="text-sm">Please ensure you have a <code>.env</code> file in the frontend's root directory with the <code>REACT_APP_GOOGLE_CLIENT_ID</code> variable set, and then restart your development server.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <MeetingsContent />
    </GoogleOAuthProvider>
  );
};

export default Meetings;