import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea'; // Corrected import
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calendar, User, AlertCircle, Info, CheckCircle, Plus, Send, Shield, Trash2, X, Loader2, Clock } from 'lucide-react';
import { useToast } from "../hooks/use-toast";
import { API_BASE_URL } from '../config/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Checkbox } from './ui/checkbox';

const Announcements = ({ announcements, setAnnouncements }) => {
  const { user, isAdmin, showNotification } = useAuth();
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    priority: 'medium',
    author: user?.name || 'Admin',
    is_scheduled: false,
    scheduled_date: '',
    scheduled_time: '',
  });
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // When announcements prop updates, stop loading
    if (announcements) setLoading(false);
  }, [announcements]);

  const priorityColors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200'
  };

  const priorityIcons = {
    high: AlertCircle,
    medium: Info,
    low: CheckCircle
  };

  const filteredAnnouncements = selectedPriority === 'all' 
    ? announcements 
    : announcements.filter(ann => ann.priority === selectedPriority);

  const convertLocalToUTC = (date, time) => {
    const localDateTimeString = `${date}T${time}`;
    const localDate = new Date(localDateTimeString);
    // The Date object is in the browser's local timezone. .toISOString() correctly converts it to UTC.
    return localDate.toISOString();
  };
  const handleCreateAnnouncement = async () => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only administrators can create announcements.",
        variant: "destructive"
      });
      return;
    }

    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      toast({
        title: "Error",
        description: "Please fill in both title and content.",
        variant: "destructive"
      });
      return;
    }

    let scheduled_at = null;
    if (newAnnouncement.is_scheduled) {
      if (!newAnnouncement.scheduled_date || !newAnnouncement.scheduled_time) {
        toast({
          title: "Scheduling Error",
          description: "Please provide both a date and time for scheduling.",
          variant: "destructive"
        });
        return;
      }
      scheduled_at = convertLocalToUTC(newAnnouncement.scheduled_date, newAnnouncement.scheduled_time);

      if (new Date(scheduled_at) < new Date()) {
        toast({
          title: "Scheduling Error",
          description: "Scheduled time cannot be in the past.",
          variant: "destructive"
        });
        return;
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${btoa(JSON.stringify(user))}`
        },
        body: JSON.stringify({
          title: newAnnouncement.title,
          content: newAnnouncement.content,
          priority: newAnnouncement.priority,
          scheduled_at: scheduled_at,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create announcement.');
      }

      // The backend broadcasts the new announcement. The listener in Dashboard.js
      // will catch it and update the state, which flows back down here.
      // No manual state update is needed here.
      // So, we don't need to manually add it here.

      toast({
        title: scheduled_at ? "Announcement Scheduled" : "Announcement Published",
        description: scheduled_at 
          ? `Your announcement will be published on ${formatDate(scheduled_at)} at ${formatTime(scheduled_at)}.`
          : "Your announcement has been published to all employees.",
      });
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setNewAnnouncement({ // Reset form regardless of success/fail
      title: '',
      content: '',
      priority: 'medium',
      author: user?.name || 'Admin',
      is_scheduled: false,
      scheduled_date: '',
      scheduled_time: '',
    });
    setShowCreateForm(false);
  };

  const handleDeleteAnnouncement = async () => {
    if (!isAdmin || !announcementToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/announcements/${announcementToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${btoa(JSON.stringify(user))}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete announcement.');
      }

      setAnnouncements(prev => prev.filter(ann => ann.id !== announcementToDelete.id));
      toast({
        title: "Announcement Deleted",
        description: `The announcement "${announcementToDelete.title}" has been removed.`,
      });

    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    // Close dialog
    setShowDeleteDialog(false);
    setAnnouncementToDelete(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(dateString));
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'No time';
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).format(new Date(dateString));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Announcements</h2>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-[#225F8B]/10 text-[#225F8B] border-[#225F8B]/20">
            {filteredAnnouncements.length} {selectedPriority === 'all' ? 'Total' : selectedPriority}
          </Badge>
          {isAdmin && (
            <Button 
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-gradient-to-r from-[#225F8B] to-[#225F8B]/80 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Announcement
            </Button>
          )}
          {!isAdmin && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
              <Shield className="h-3 w-3 mr-1" />
              Admin Only
            </Badge>
          )}
        </div>
      </div>

      {/* Create Announcement Form */}
      {showCreateForm && isAdmin && (
        <Card className="bg-gradient-to-r from-[#225F8B]/5 to-[#225F8B]/10 border-[#225F8B]/20">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Create New Announcement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title" className="text-sm font-medium text-gray-700">
                  Title
                </Label>
                <Input
                  id="title"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                  placeholder="Enter announcement title"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="priority" className="text-sm font-medium text-gray-700">
                  Priority
                </Label>
                <Select 
                  value={newAnnouncement.priority} 
                  onValueChange={(value) => setNewAnnouncement({...newAnnouncement, priority: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="low">Low Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-4 rounded-md border border-gray-200 p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_scheduled"
                  checked={newAnnouncement.is_scheduled}
                  onCheckedChange={(checked) => setNewAnnouncement({ ...newAnnouncement, is_scheduled: checked })}
                />
                <Label htmlFor="is_scheduled" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Schedule for later
                </Label>
              </div>
              {newAnnouncement.is_scheduled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label htmlFor="scheduled_date">Date</Label>
                    <Input
                      id="scheduled_date"
                      type="date"
                      value={newAnnouncement.scheduled_date}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, scheduled_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="scheduled_time">Time</Label>
                    <Input
                      id="scheduled_time"
                      type="time"
                      value={newAnnouncement.scheduled_time}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, scheduled_time: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="content" className="text-sm font-medium text-gray-700">
                Content
              </Label>
              <Textarea
                id="content"
                value={newAnnouncement.content}
                onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                placeholder="Enter announcement content"
                rows={4}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewAnnouncement({
                    title: '',
                    content: '',
                    priority: 'medium',
                    author: user?.name || 'Admin',
                    is_scheduled: false,
                    scheduled_date: '',
                    scheduled_time: '',
                  });
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateAnnouncement}
                className="bg-gradient-to-r from-[#225F8B] to-[#225F8B]/80 text-white"
              >
                {newAnnouncement.is_scheduled ? <Clock className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {newAnnouncement.is_scheduled ? 'Schedule Announcement' : 'Publish Now'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Priority Filter */}
      <div className="flex flex-wrap gap-2">
        {['all', 'high', 'medium', 'low'].map((priority) => (
          <Button
            key={priority}
            variant={selectedPriority === priority ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedPriority(priority)}
            className={`transition-all duration-200 ${
              selectedPriority === priority
                ? 'bg-gradient-to-r from-[#225F8B] to-[#225F8B]/80 text-white'
                : 'hover:bg-[#225F8B]/10 hover:border-[#225F8B]/50'
            }`}
          >
            {priority.charAt(0).toUpperCase() + priority.slice(1)}
          </Button>
        ))}
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#225F8B]" />
            <span className="ml-2 text-gray-600">Loading Announcements...</span>
          </div>
        ) :
        
        
        filteredAnnouncements.length > 0 ? (
          filteredAnnouncements.map((announcement) => {
            const PriorityIcon = priorityIcons[announcement.priority];

            if (announcement.type === 'birthday-personal') {
              return (
                <Card
                  key={announcement.id}
                  className="border-0 bg-gradient-to-r from-purple-50 via-pink-50 to-rose-50 hover:shadow-lg transition-all duration-300"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold text-rose-800">
                        🎉 {announcement.title}
                      </CardTitle>
                      <Badge variant="outline" className="bg-pink-200 text-pink-800 border-pink-300">
                        Your Birthday!
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-rose-700 leading-relaxed whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-rose-600 mt-3">
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4" />
                        <span>{announcement.author}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            if (announcement.type === 'birthday') {
              return (
                <Card 
                  key={announcement.id} 
                  className="border-0 bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 hover:shadow-lg transition-all duration-300"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold text-amber-800">
                        🎂 {announcement.title}
                      </CardTitle>
                      <Badge variant="outline" className="bg-yellow-200 text-yellow-800 border-yellow-300">
                        Birthday
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-amber-700 leading-relaxed whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-amber-600 mt-3">
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4" />
                        <span>{announcement.author}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card 
                key={announcement.id} 
                className="hover:shadow-lg transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-full ${priorityColors[announcement.priority]}`}>
                        <PriorityIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold text-gray-900 mb-2">
                          {announcement.title}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(announcement.scheduled_at || announcement.created_at || announcement.date)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{formatTime(announcement.scheduled_at || announcement.created_at || announcement.date)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <User className="h-4 w-4" />
                            <span>{announcement.author}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <Badge 
                        variant="outline" 
                        className={priorityColors[announcement.priority]}
                      >
                        {announcement.priority}
                      </Badge>
                      {isAdmin && announcement.type !== 'birthday' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 h-7 w-7 p-1"
                          onClick={() => { setAnnouncementToDelete(announcement); setShowDeleteDialog(true); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {announcement.content}
                  </p>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Announcements Found
              </h3>
              <p className="text-gray-600">
                No announcements match the selected priority filter.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Delete Announcement
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the announcement "<strong>{announcementToDelete?.title}</strong>"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAnnouncement}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Stats */}
      <Card className="bg-gradient-to-r from-[#225F8B]/5 to-[#225F8B]/10 border-[#225F8B]/20">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {announcements.filter(a => a.priority === 'high').length}
              </div>
              <div className="text-sm text-gray-600">High Priority</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {announcements.filter(a => a.priority === 'medium').length}
              </div>
              <div className="text-sm text-gray-600">Medium Priority</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {announcements.filter(a => a.priority === 'low').length}
              </div>
              <div className="text-sm text-gray-600">Low Priority</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Announcements;