import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Added navigateToChat
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Bell, X, MessageSquare, Megaphone, Clock, Check } from 'lucide-react';

const NotificationSystem = ({
  newMessages = [],
  newAnnouncements = [],
  onNotificationClick,
  onClearAll,
  clearNewMessages, // This is for messages
  setNewMessages, // This is for messages
  setNewAnnouncements, // This is for announcements
  onSectionChange
}) => {
  const { user, navigateToChat, getReadAnnouncementIds, markAnnouncementAsRead, getReadMessageIds, markMessageAsRead } = useAuth(); // navigateToChat is already here
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLocallyCleared, setIsLocallyCleared] = useState(false);
  const notifiedRef = useRef(new Set());

  // Combine all notifications with proper filtering
  useEffect(() => {
    // console.log("NotificationSystem - newMessages received:", newMessages);
    // console.log("NotificationSystem - user:", user);

    // If the user has locally cleared their notifications, show nothing.
    if (isLocallyCleared) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Get read message IDs from localStorage
    const readMessageIds = getReadMessageIds();

    // Filter messages to ensure they belong to current user
    const messageNotifications = (newMessages || [])
      .filter(msg => !readMessageIds.includes(msg.id)) // Filter out read messages
      .filter(msg => { // This filter is primarily to prevent self-notifications
        // Ensure user is logged in
        if (!user?.email) {
          console.log("NotificationSystem: No user logged in, skipping message:", msg);
          return false;
        }
        // Skip messages from the current user (they shouldn't see their own messages as notifications)
        if (msg.sender_id === user.email) { // Use user.email for comparison
          console.log("NotificationSystem: Skipping message from current user:", msg);
          return false;
        }
        // All other filtering (recipient, channel membership) is handled in AuthContext
        // before messages are added to newMessages. So, if it's in newMessages and not from the current user, it's relevant.
        return true; // Keep the message if it's not from the current user
      })
      .map(msg => ({
        id: `msg_${msg.id}`,
        type: msg.type || 'message',
        title: msg.type === 'missed_message' ? 'Missed Message' : 'New Message',
        message: msg.channel ? `${msg.channel} - ${msg.senderName}: ${msg.content}` : `${msg.senderName}: ${msg.content}`,
        timestamp: msg.timestamp,
        read: false,
        data: msg
      }));

    // Get read announcement IDs from localStorage
    const readAnnouncementIds = getReadAnnouncementIds();

    const announcementNotifications = (newAnnouncements || [])
      .filter(ann => !readAnnouncementIds.includes(ann.id)) // Filter out read announcements
      .map(ann => ({
        id: `ann_${ann.id}`,
        type: 'announcement',
        title: `📢 ${ann.title}`,
        message: `Priority: ${ann.priority.charAt(0).toUpperCase() + ann.priority.slice(1)}`,
        timestamp: ann.date,
        read: false, // All announcements that get through the filter are unread
        data: ann
      }));

    const allNotifications = [...messageNotifications, ...announcementNotifications];
    setNotifications(allNotifications);
    setUnreadCount(allNotifications.filter(n => !n.read).length);

    // Reset cleared state if there are new messages
    if (allNotifications.length > 0) {
      setIsLocallyCleared(false);
    }
  }, [newMessages, newAnnouncements, user, isLocallyCleared, getReadAnnouncementIds, getReadMessageIds]);

  // Browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Send browser notifications (excluding message types, but allowing missed_message)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const unreadNotifications = notifications.filter(n => !n.read);

      unreadNotifications.forEach(notification => {
        // Only show a browser notification if we haven't shown it before for this session.
        if (!notifiedRef.current.has(notification.id)) {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico', // Ensure this icon exists in your public folder
            tag: notification.id, // Use a unique tag to prevent multiple popups for the same notification
          });
          notifiedRef.current.add(notification.id); // Mark as notified
        }
      });
      }
  }, [notifications]);

  const handleNotificationClick = (notification) => {
    // Mark as read
    setNotifications(prev => 
      prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      )
    );
    
    // Callback for handling the notification click
    if (onNotificationClick) {
      onNotificationClick(notification);
    }

    // Persist the read state for the clicked message
    if (notification.type.includes('message') && setNewMessages) {
      markMessageAsRead(notification.data.id);
      setNewMessages(prev => prev.filter(msg => msg.id !== notification.data.id));
    }
    
    // Navigation logic
    if (notification.type === 'announcement') {
      if (onSectionChange) {
        // Persist the read state
        markAnnouncementAsRead(notification.data.id);
        onSectionChange('announcements');
      }
    } else if (notification.data) { // Handle chat navigation
      if (notification.data.channel) { // Channel message
        navigateToChat({ type: 'channel', id: notification.data.channel });
      } else if (notification.data.isDirectMessage) { // Direct message
        navigateToChat({ type: 'dm', id: notification.data.senderName });
      }
    }

    setShowPanel(false);
  };

  const handleClearAll = () => {
    // Mark all visible notifications as read in localStorage
    notifications.forEach(notification => {
      if (notification.type === 'announcement') {
        markAnnouncementAsRead(notification.data.id);
      } else if (notification.type.includes('message')) {
        markMessageAsRead(notification.data.id);
      }
    });

    // Also clear the global states in AuthContext to remove them from the source
    clearNewMessages(); // This clears the newMessages array
    // We can't just clear newAnnouncements as it's a global list, but they are now marked as read.

    setIsLocallyCleared(true);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="h-4 w-4 text-blue-600" />;
      case 'missed_message':
        return <MessageSquare className="h-4 w-4 text-blue-600" />;
      case 'announcement':
        return <Megaphone className="h-4 w-4 text-orange-600" />;
      default:
        return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'message':
        return 'border-l-blue-500 bg-blue-50';
      case 'missed_message':
        return 'border-l-blue-500 bg-blue-50';
      case 'announcement':
        return 'border-l-orange-500 bg-orange-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowPanel(!showPanel)}
        className="relative p-2"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Panel */}
      {showPanel && (
        <Card className="absolute top-12 right-0 w-80 max-h-[500px] overflow-hidden shadow-xl z-50 border-0">
          <div className="p-4 border-b border-gray-200 bg-white/90">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  {unreadCount} unread
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPanel(false)}
                  className="p-1"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <CardContent className="p-0 max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No new notifications</p>
              </div>
            ) : (
              <div className="space-y-1">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 border-l-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      getNotificationColor(notification.type)
                    } ${!notification.read ? 'bg-opacity-100' : 'bg-opacity-50'}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {notification.title}
                          </p>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500 flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatTime(notification.timestamp)}
                            </span>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 truncate">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          {/* Clear All Button - Always visible when there are notifications */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-red-50">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAll}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                <Check className="h-4 w-4 mr-2" />
                Clear All Notifications ({notifications.length})
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default NotificationSystem;
