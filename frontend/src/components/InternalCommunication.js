import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { API_BASE_URL } from '../config/api';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
// import { Separator } from './ui/separator'; // Not used
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from './ui/dropdown-menu';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'; // Not used
import {
  Hash,
  Users,
  Search,
  // Plus, // Not used
  Settings,
  MessageSquare,
  Clock,
  UserPlus,
  Building,
  // Dot, // Not used
  Trash2,
  ArrowLeft,
  MoreVertical,
  Circle,
  Check
} from 'lucide-react';
import {
  // COMMUNICATION_CHANNELS, // Now fetched from API
  // MOCK_MESSAGES, // To be replaced by WebSocket messages
  USER_STATUS as MOCK_USER_STATUS // Keep for "busy" status, online/offline from AuthContext
} from '../data/mock';
import DirectChat from './DirectChat'; // This component will handle the 1-on-1 chat
import chatImage from '../data/chat.jpg'; // Import the placeholder image
import ChatInput from './ChatInput'; // Extracted input logic for reusability
import { FileMessage } from './FileUpload'; // Import the FileMessage component

const MessageStatus = ({ status }) => {
  // In channel chat, we only show the 'sent' status (single tick).
  // The logic is simplified to just show one tick if the status is 'sent'.
  if (status !== 'sent') {
    return null;
  }

  return (
    <div className="relative flex items-center w-4 h-4">
      {/* Single grey tick for sent */}
      <Check className="absolute left-0 h-4 w-4 text-gray-400" />
    </div>
  );
};

const InternalCommunication = () => {
  const { user, sendWebSocketMessage, userStatuses, newMessages, allChannels, allEmployees, navigationTarget, clearChatNotifications } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]); // Messages will come from WebSocket and API
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('channels');
  // const [userStatus, setUserStatusState] = useState(MOCK_USER_STATUS.ONLINE); // Current user's status, primarily for "busy"
  const [allEmployeesList, setAllEmployeesList] = useState([]); // For people tab
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [viewMode, setViewMode] = useState('channels'); // 'channels' or 'directChat'
  const messagesEndRef = useRef(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  
  // Use a ref to track the selected channel to avoid stale closures in the WebSocket listener
  const selectedChannelRef = useRef(selectedChannel);
  selectedChannelRef.current = selectedChannel;
  const [reactionPopup, setReactionPopup] = useState({
    open: false,
    emoji: null,
    users: [],
  });
  const [replyTo, setReplyTo] = useState(null);

  // Use pre-fetched data from AuthContext
  useEffect(() => {
    setAllEmployeesList(allEmployees);
  }, [allEmployees]);

  // Fetch unread counts from the backend
  const fetchUnreadCounts = useCallback(async () => {
    if (user?.email) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/messages/unread-count?user_id=${user.email}`);
        if (response.ok) {
          const counts = await response.json();
          setUnreadCounts(counts);
        }
      } catch (error) {
        console.error("Failed to fetch unread counts:", error);
      }
    }
  }, [user?.email]);

  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]); // Only fetch on initial load


  // Format channels and calculate member counts in a single effect
  useEffect(() => {
    if (allChannels.length > 0 && allEmployees.length > 0) {
      const updatedChannels = allChannels.map(channel => {
        let memberCount = 0; // Start from zero to ensure fresh calculation
        if (channel.name === 'general') {
          memberCount = allEmployees.length;
        } else if (channel.type === 'department') {
          // The department name is in the channel object, e.g., 'DMC'
          memberCount = allEmployees.filter(emp => emp.department === channel.department).length;
        } else if (channel.type === 'team') {
          // The team name is in the subDepartment field, e.g., 'Digital Production'
          memberCount = allEmployees.filter(emp => emp.team === channel.subDepartment).length;
        }
        return {
          ...channel,
          name: channel.name || channel.id,
          type: channel.type || 'public',
          description: channel.description || '',
          memberCount, // Use the newly calculated count
        };
      });
      setChannels(updatedChannels);
    }
  }, [allEmployees, allChannels]); // Rerun when allEmployees or the base channels list changes

  // Load persisted state from localStorage after user and channels are available
  useEffect(() => {
    if (!user || channels.length === 0) return; // Wait for user and channels to be ready

    // Do NOT auto-select any channel on load.
    // This ensures the placeholder is shown until the user makes a selection.
    setSelectedChannel(null);

  }, [user?.email, channels]);

  useEffect(() => {
    const savedViewMode = localStorage.getItem('viewMode');
    const savedEmployeeId = localStorage.getItem('selectedEmployeeId');
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
    if (savedEmployeeId && allEmployeesList.length > 0) {
      const employee = allEmployeesList.find(e => e.email === savedEmployeeId);
      if (employee) {
        setSelectedEmployee(employee);
      }
    }
  }, [allEmployeesList]);

  // Handle navigation from notifications
  useEffect(() => {
    // This effect handles navigation from the notification system.
    if (navigationTarget && navigationTarget.section === 'communication' && channels.length > 0 && allEmployeesList.length > 0) {
      if (navigationTarget.type === 'channel') {
        const channelToSelect = channels.find(c => c.name === navigationTarget.id);
        if (channelToSelect) {
          setViewMode('channels');
          setActiveTab('channels');
          setSelectedChannel(channelToSelect);
          fetchMessagesForChannel(channelToSelect);
        }
      } else if (navigationTarget.type === 'dm') {
        // The ID from the notification is the sender's name. We need to find the employee object.
        const employeeToSelect = allEmployeesList.find(e => e.name === navigationTarget.id);
        if (employeeToSelect) {
          setViewMode('directChat');
          setActiveTab('people');
          setSelectedEmployee(employeeToSelect);
        }
      }
      // It's important to clear the target after navigation to prevent re-triggering
      // This can be done in AuthContext, but for simplicity, we assume it's a one-time event.
    }
  }, [navigationTarget, channels, allEmployeesList]);

  // Current user's status from AuthContext, default to 'offline' if not found
  const currentUserStatus = userStatuses[user?.email] || MOCK_USER_STATUS.OFFLINE;

  // Fetch old messages when clicking on a channel
  const fetchMessagesForChannel = async (channel) => {
    if (channel && user?.email) {
      try {
        console.log('Fetching messages for channel:', channel.name, 'for user:', user.email);
        const response = await fetch(`${API_BASE_URL}/api/channel-messages?channel_id=${channel.name}&user_id=${user.email}&limit=50`);
        console.log('Fetch response status:', response.status);
        if (response.ok) {
          let oldMessages = await response.json();
          console.log('Fetched old messages:', oldMessages.length);
          
          // Process fetched messages to add status
          const processedMessages = oldMessages.map(msg => {
            // For channel messages, we can simplify the status.
            // If it's from the current user and has an ID, it's 'sent'.
            // The backend doesn't provide read receipts for channels in this implementation.
            const status = (msg.sender_id === user.email && msg.id) ? 'sent' : 'none';
            return { ...msg, status };
          });

          setMessages(processedMessages);
        } else {
          console.error('Failed to fetch messages:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    }
  };

  // WebSocket message handling
  useEffect(() => {
    const handleWebSocketMessage = (event) => {
      const incomingMessage = event.detail;
      console.log("InternalCommunication received WS message:", incomingMessage);

      // CANCEL NOTIFICATION IF USER IS CURRENTLY VIEWING THIS CHANNEL
      if (
        incomingMessage.type === "channel_message" &&
        incomingMessage.channel_id === selectedChannelRef.current?.name
      ) {
        // Do NOT notify; user is inside this channel
        // The message will still be processed and added to the view below.
        // return; // This was the original instruction, but we need to process the message to display it. The check is good for clarity.
      }

      if (incomingMessage.type === 'channel_message') {
        // This is a channel message. We need to check if it belongs to the currently selected channel.
        // Use the ref to get the current channel without causing re-renders or stale state.
        const currentSelectedChannel = selectedChannelRef.current;
        if (currentSelectedChannel && (incomingMessage.channel_id === currentSelectedChannel.name || incomingMessage.recipient_id === currentSelectedChannel.name)) {
          // Message for the currently open channel, add it to the view.
          setMessages(prevMessages => {
            const isDuplicate = prevMessages.some(m => m.id === incomingMessage.id);
            if (isDuplicate) return prevMessages;
            return [...prevMessages, incomingMessage];
          });
          // No need to fetch counts; the backend will push an 'unread_count_update' event.
        } else {
          // Message for a different channel. The badge is handled by AuthContext.
          // The backend will push an 'unread_count_update' event to update the badge.
          // No need to add it to the current `messages` state.
          console.log(`Received message for other channel: ${incomingMessage.channel_id}`);
        }
      } else if (incomingMessage.type === 'personal_message') {
        // This is a direct message. It's handled in the DirectChat component.
        console.log("Received a direct message, but not in a channel view.", incomingMessage);
      } else if (incomingMessage.type === 'missed_messages') {
        // Handle missed messages sent upon reconnection
        const missed = incomingMessage.messages || [];
        console.log(`Received ${missed.length} missed messages`);
        // These messages are already in the `newMessages` state via AuthContext.
        // We just need to merge them into the current view if the channel matches.
        const currentSelectedChannel = selectedChannelRef.current;
        if (currentSelectedChannel) {
            const relevantMissedMessages = missed.filter(msg => msg.channel_id === currentSelectedChannel.name);
            if (relevantMissedMessages.length > 0) {
                setMessages(prev => [...prev, ...relevantMissedMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
            }
        }
      } else if (incomingMessage.type === 'reaction_update') {
        console.log("InternalCommunication received reaction update:", incomingMessage);
        setMessages(prevMessages => prevMessages.map(msg =>
          msg.id === incomingMessage.message_id
            ? { ...msg, reactions: incomingMessage.reactions || [] }
            : msg
        ));
      } else if (incomingMessage.type === 'message_update') {
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === incomingMessage.message_id
              ? { ...msg, ...incomingMessage.updates } // Apply updates from the server
              : msg
          )
        );
      } else if (incomingMessage.type === 'message_confirmation') {
        // Server confirms a channel message is saved (✔ single tick)
        setMessages(prev =>
          prev.map(m =>
            m.id === incomingMessage.optimistic_id
              ? { ...m, id: incomingMessage.final_id, timestamp: incomingMessage.timestamp, isOptimistic: false, status: 'sent' }
              : m)
        );
      } else if (incomingMessage.type === 'unread_count_update') {
        // Server pushed new unread counts, update the state directly.
        console.log("Received unread_count_update from WS:", incomingMessage.counts);
        setUnreadCounts(incomingMessage.counts);
      }
    };

    window.addEventListener('websocket-message', handleWebSocketMessage);
    return () => {
      window.removeEventListener('websocket-message', handleWebSocketMessage);
    };
  }, [user]); // The dependency array is now simplified and stable.

  // Scroll to bottom on new messages
  useEffect(() => {
    const chatContainer = messagesEndRef.current?.parentElement;
    if (!chatContainer) return;

    // Only auto-scroll if the user is already near the bottom
    const isScrolledToBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 100;

    if (isScrolledToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

// In InternalCommunication.js

const handleDeleteForMe = async (messageId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}/delete?user_id=${user.email}`, {
      method: 'POST',
    });
    if (response.ok) {
      // Correctly filter out the message from the local state
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
    } else {
      alert('Failed to delete message for me.');
    }
  } catch (error) {
    console.error('Error deleting message for me:', error);
    alert('Error deleting message.');
  }
};


// Delete for everyone
const handleDeleteForEveryone = async (messageId) => {
  if (messageId.startsWith('optimistic-')) {
    alert('Please wait for the message to be confirmed before deleting.');
    return;
  }

  if (!window.confirm('Delete this message for everyone?')) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}/delete-everyone?user_id=${user.email}`, {
      method: 'POST',
    });
    if (response.ok) {
      setMessages(messages.map(msg =>
        msg.id === messageId
          ? { ...msg, deleted: true, content: 'This message was deleted' }
          : msg
      ));
    } else {
      alert('Failed to delete message for everyone.');
    }
  } catch (error) {
    console.error('Error deleting message for everyone:', error);
    alert('Error deleting message.');
  }
};

// Clear channel chat
const handleDeleteMessages = async () => {
  if (!window.confirm("Are you sure you want to clear this channel chat for yourself?")) return;
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/channel-messages/clear-for-user?channel_id=${selectedChannel.name}&user_id=${user.email}`,
      { method: 'POST' }
    );
    if (response.ok) {
      setMessages([]); // Clear messages locally
    } else {
      alert('Failed to clear chat.');
    }
  } catch (error) {
    alert('Error clearing chat.');
  }
};

const handleReactionClick = (message, emoji) => {
  const reactionUsers = message.reactions
     .filter(r => r.reaction_type === emoji)
     .map(r => r.user_id);

  setReactionPopup({
    open: true,
    emoji,
    users: reactionUsers,
  });
};


  const handleReplyMessage = (message) => {
    setReplyTo(message);
  };

  const handleCopyMessage = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy message:', error);
      alert('Failed to copy message.');
    }
  };

  const handleEmojiReaction = (messageId, emoji) => {
    if (!messageId) return;
    // Check if user already reacted with this emoji
    const message = messages.find(msg => msg.id === messageId);
    const existingReaction = message?.reactions?.find(r => r.user_id === user.email && r.reaction_type === emoji);
    const userExistingReaction = message?.reactions?.find(r => r.user_id === user.email);

    let action;
    let reactionType = emoji;

    if (existingReaction) {
      // User clicked the same emoji they already reacted with - remove it
      action = 'remove';
    } else if (userExistingReaction) {
      // User has a different reaction - replace it
      action = 'replace';
      reactionType = emoji; // New emoji to replace with
    } else {
      // User has no reaction - add new one
      action = 'add';
    }

    // Send reaction update to backend
    const reactionUpdate = {
      type: 'reaction_update',
      message_id: messageId,
      reaction_type: reactionType,
      action: action,
      old_reaction_type: userExistingReaction ? userExistingReaction.reaction_type : null
    };
    sendWebSocketMessage(reactionUpdate);

    // Optimistically update local state
    setMessages(prevMessages => prevMessages.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || [];
        if (action === 'add') {
          // Add reaction if not already present
          const existingReaction = reactions.find(r => r.user_id === user.email && r.reaction_type === emoji);
          if (!existingReaction) {
            reactions.push({ user_id: user.email, reaction_type: emoji });
          }
        } else if (action === 'remove') {
          // Remove reaction
          const filteredReactions = reactions.filter(r => !(r.user_id === user.email && r.reaction_type === emoji));
          return { ...msg, reactions: filteredReactions };
        } else if (action === 'replace') {
          // Replace existing reaction with new one
          const filteredReactions = reactions.filter(r => !(r.user_id === user.email));
          filteredReactions.push({ user_id: user.email, reaction_type: emoji });
          return { ...msg, reactions: filteredReactions };
        }
        return { ...msg, reactions };
      }
      return msg;
    }));
  };

  const groupReactions = (reactions) => {
    if (!reactions) return [];
    const grouped = {};
    reactions.forEach(r => {
      if (!grouped[r.reaction_type]) {
        grouped[r.reaction_type] = { emoji: r.reaction_type, count: 0, users: [] };
      }
      grouped[r.reaction_type].count += 1;
      grouped[r.reaction_type].users.push(r.user_id);
    });
    return Object.values(grouped);
  };

  const handleEmployeeClick = (employee) => {
    setSelectedEmployee(employee); // employee object should have an 'id' or 'Email ID'
    setViewMode('directChat');

    // Instantly clear notifications for this user from the notification center.
    clearChatNotifications(employee.email, false);
    
    // Clear unread count for this user
    // This is now the ONLY state update needed. It will trigger a re-render
    // and the unreadCounts will be recalculated correctly.
    // Mark ALL messages from this user as read
    sendWebSocketMessage({
        type: "mark_messages_read",
        message_ids: newMessages
          .filter(msg => msg.sender_id === employee.email)
          .map(m => m.id),
        chat_partner_id: employee.email
    });
    
    // Persist the view mode and selected user for better UX on refresh
    localStorage.setItem('viewMode', 'directChat');
    localStorage.setItem('selectedEmployeeId', employee.email); // Use email as the unique ID
  };
  const handleBackToChannels = () => {
    setViewMode('channels');
    setSelectedEmployee(null);
    localStorage.setItem('viewMode', 'channels');
    setActiveTab('channels'); // Reset to channels tab
    localStorage.removeItem('selectedEmployeeId');
  };

  const handleSetBusyStatus = () => {
    if (user && user.email) {
      const newStatus = currentUserStatus === MOCK_USER_STATUS.BUSY ? MOCK_USER_STATUS.ONLINE : MOCK_USER_STATUS.BUSY;
      // setUserStatusState(newStatus); // Local state for busy
      sendWebSocketMessage({
        type: 'set_status',
        user_id: user.email,
        status: newStatus,
      });
    }
  };

  const getStatusColor = useCallback((statusKey) => {
    // statusKey is like "online", "offline", "busy"
    const statusMap = {
      [MOCK_USER_STATUS.ONLINE]: 'text-green-500',
      [MOCK_USER_STATUS.BUSY]: 'text-red-500',
      [MOCK_USER_STATUS.OFFLINE]: 'text-gray-400',
    };
    return statusMap[statusKey] || 'text-gray-400';
  }, []);

  const getStatusText = useCallback((statusKey) => {
    const statusTextMap = {
      [MOCK_USER_STATUS.ONLINE]: 'Online',
      [MOCK_USER_STATUS.BUSY]: 'Busy',
      [MOCK_USER_STATUS.OFFLINE]: 'Offline',
    };
    return statusTextMap[statusKey] || 'Unknown';
  }, []);

  const handleSendMessage = (messageContent, file) => {
    if (!user || !selectedChannel) return;

    const messagePayload = {
      type: 'channel_message',
      recipient_id: selectedChannel.name,
      sender_id: user.email,
      sender_name: user.name,
      content: messageContent,
      reply_to: replyTo ? replyTo.id : null,
    };

    if (file) {
      messagePayload.file_name = file.file_name;
      messagePayload.file_type = file.file_type;
      messagePayload.file_size = file.file_size;
      messagePayload.file_url = file.file_url;
    }

    sendWebSocketMessage(messagePayload);

    // Optimistically add the message to the UI for instant feedback
    const optimisticMessage = {
      id: `optimistic-${Date.now()}`,
      sender_id: user.email,
      sender_name: user.name,
      content: messageContent,
      reply_to: replyTo ? replyTo.id : null,
      timestamp: new Date().toISOString(),
      channel_id: selectedChannel.name,
      recipient_id: selectedChannel.name, // Include for consistency
      type: 'channel_message',
      isOptimistic: true,
      reactions: [],
      status: 'sending', // Initial status
      file_name: file ? file.file_name : null,
      file_type: file ? file.file_type : null,
      file_size: file ? file.file_size : null,
      file_url: file ? file.file_url : null,
    };

    setMessages(prevMessages => [...prevMessages, optimisticMessage]);

    // Reset state after sending
    setReplyTo(null);
  };

  const getChannelMessages = () => {
    // Filter messages for the currently selected channel
    if (!selectedChannel) return [];
    // Prefer channel_id, but fallback to recipient_id for older message structures
    return messages.filter(msg => msg.channel_id === selectedChannel.name || msg.recipient_id === selectedChannel.name);
  };

  const getFilteredChannels = () => {
    return channels.filter(channel =>
      channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (channel.description && channel.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  // This uses API data. Employee list with statuses comes from backend or AuthContext.userStatuses
  const getEmployeesForPeopleTab = () => {
    return allEmployeesList
      .filter(emp => emp.email && emp.email !== user?.email) // Ensure employee has an email and exclude current user
      .map(emp => ({
        ...emp,
        // The user ID for status is the email
        status: userStatuses[emp.email] || MOCK_USER_STATUS.OFFLINE
      }));
  };


  const formatTime = (timestamp) => {
    if (!timestamp) return 'No time';
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Invalid timestamp:', timestamp);
      return 'Invalid time';
    }
  };

  const getDateLabel = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const getChannelIcon = (channel) => {
    if (!channel) return <Hash className="h-4 w-4" />;
    if (channel.type === 'public') return <Hash className="h-4 w-4" />;
    if (channel.type === 'department') return <Building className="h-4 w-4" />;
    return <Users className="h-4 w-4" />;
  };

  const renderSidebar = () => (
    <div className={`w-full md:w-80 bg-white/90 backdrop-blur-sm border-r border-gray-200 flex flex-col ${selectedChannel || selectedEmployee ? 'hidden md:flex' : 'flex'}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">ShowTime Chat</h2>
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <Circle className={`h-3 w-3 fill-current ${getStatusColor(currentUserStatus)}`} />
                  <span className="text-sm">{getStatusText(currentUserStatus)}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Set Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Online/Offline is automatic via WebSocket connection */}
                {/* Allow setting Busy */}
                <DropdownMenuItem onClick={handleSetBusyStatus}>
                  <Circle className={`h-3 w-3 fill-current ${currentUserStatus === MOCK_USER_STATUS.BUSY ? getStatusColor(MOCK_USER_STATUS.ONLINE) : getStatusColor(MOCK_USER_STATUS.BUSY)} mr-2`} />
                  {currentUserStatus === MOCK_USER_STATUS.BUSY ? "Set to Online" : "Set to Busy"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search channels, people..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex space-x-1 mb-4">
          {[
            { id: 'channels', label: 'Channels', icon: Hash },
            { id: 'people', label: 'People', icon: Users },
            { id: 'directory', label: 'Directory', icon: Building }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 ${
                  activeTab === tab.id 
                    ? 'bg-[#225F8B] text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4 mr-1" />
                {tab.label}
              </Button>
            );
          })}
        </div>

      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'channels' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                <Hash className="h-3 w-3 mr-1" /> Public Channels
              </h3>
              {getFilteredChannels().filter(ch => ch.type === 'public').map((channel) => (
                <Button
                  key={channel.id}
                  variant="ghost"
                  className={`w-full justify-start px-2 py-1 h-auto mb-1 ${
                    selectedChannel?.name === channel.name
                      ? 'bg-[#225F8B]/10 text-[#225F8B]'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setSelectedChannel(channel);
                    clearChatNotifications(channel.name, true);
                    localStorage.setItem('selectedChannelName', channel.name);
                    fetchMessagesForChannel(channel);
                    // Clear unread count for this channel by updating the central state
                    sendWebSocketMessage({
                      type: 'mark_messages_read',
                      // We no longer send message_ids for channels.
                      // The backend will mark all messages in this channel as read for the user.
                      channel_id: channel.name,
                    });
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-2">
                      <Hash className="h-4 w-4" />
                      <span className="font-medium">{channel.name}</span>
                      {unreadCounts[channel.name] > 0 && (
                        <Badge className="bg-[#225F8B] text-white rounded-full h-5 w-5 p-0 flex items-center justify-center">{unreadCounts[channel.name]}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 ml-auto">{channel.memberCount}</span>
                  </div>
                </Button>
              ))}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                <Building className="h-3 w-3 mr-1" /> Department Channels
              </h3>
              {getFilteredChannels().filter(ch => ch.type === 'department').map((channel) => (
                <Button
                  key={channel.id}
                  variant="ghost"
                  className={`w-full justify-start px-2 py-1 h-auto mb-1 ${
                    selectedChannel?.name === channel.name
                      ? 'bg-[#225F8B]/10 text-[#225F8B]'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setSelectedChannel(channel);
                    clearChatNotifications(channel.name, true);
                    localStorage.setItem('selectedChannelName', channel.name);
                    fetchMessagesForChannel(channel);
                    // Clear unread count for this channel by updating the central state
                    sendWebSocketMessage({
                      type: 'mark_messages_read',
                      channel_id: channel.name,
                    });
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-2">
                      <Hash className="h-4 w-4" />
                      <span className="font-medium">{channel.name}</span>
                      {unreadCounts[channel.name] > 0 && (
                        <Badge className="bg-[#225F8B] text-white rounded-full h-5 w-5 p-0 flex items-center justify-center">{unreadCounts[channel.name]}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 ml-auto">{channel.memberCount}</span>
                  </div>
                </Button>
              ))}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                <Users className="h-3 w-3 mr-1" /> Team Channels
              </h3>
              {getFilteredChannels().filter(ch => ch.type === 'team').map((channel) => (
                <Button
                  key={channel.id}
                  variant="ghost"
                  className={`w-full justify-start px-2 py-1 h-auto mb-1 ${
                    selectedChannel?.name === channel.name
                      ? 'bg-[#225F8B]/10 text-[#225F8B]'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setSelectedChannel(channel);
                    clearChatNotifications(channel.name, true);
                    localStorage.setItem('selectedChannelName', channel.name);
                    fetchMessagesForChannel(channel);
                    // Clear unread count for this channel by updating the central state
                    sendWebSocketMessage({
                      type: 'mark_messages_read',
                      channel_id: channel.name,
                    });
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-2">
                      <Hash className="h-4 w-4" />
                      <span className="font-medium text-sm">{channel.name}</span>
                      {unreadCounts[channel.name] > 0 && (
                        <Badge className="bg-[#225F8B] text-white rounded-full h-5 w-5 p-0 flex items-center justify-center">{unreadCounts[channel.name]}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 ml-auto">{channel.memberCount}</span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'people' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">All Employees</h3>
              <span className="text-xs text-gray-500">{getEmployeesForPeopleTab().length} members</span>
            </div>
            {getEmployeesForPeopleTab() // The function already filters out the current user
              .filter(emp => emp.name && emp.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((emp) => (
                <div
                  key={emp.email || emp.id}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleEmployeeClick(emp)} // emp here is the full employee object from mock
                >
                  <div className="relative">
                    <Avatar className="w-8 h-8">
                      {emp.profilePicture && (
                        <img src={emp.profilePicture} alt={emp.name} className="w-full h-full object-cover" />
                      )}
                      <AvatarFallback className="bg-[#225F8B] text-white text-xs">
                        {emp.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-0 -right-0 w-3 h-3 border-2 border-white rounded-full ${
                       (userStatuses[emp.email] === MOCK_USER_STATUS.ONLINE) ? 'bg-green-500' :
                       (userStatuses[emp.email] === MOCK_USER_STATUS.BUSY) ? 'bg-red-500' : 'bg-gray-400'
                    }`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <div className="text-sm font-medium text-gray-900 truncate">{emp.name}</div>
                      {unreadCounts[emp.email] > 0 && (
                        <Badge className="bg-[#225F8B] text-white rounded-full h-5 w-5 p-0 flex items-center justify-center">{unreadCounts[emp.email]}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate flex items-center" title={emp.designation + ' • ' + emp.department}>
                      <span>{emp.designation}</span>
                      <span className={`ml-2 text-xs ${getStatusColor(userStatuses[emp.email] || MOCK_USER_STATUS.OFFLINE)}`}>
                        {getStatusText(userStatuses[emp.email] || MOCK_USER_STATUS.OFFLINE)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {activeTab === 'directory' && (
          <div className="space-y-4"> {/* Directory now uses API data */}
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Company Directory</h3>
            {Object.entries(allEmployeesList.reduce((acc, emp) => { // Use 'department'
              if (!acc[emp.department]) acc[emp.department] = [];
              acc[emp.department].push(emp);
              return acc;
            }, {})).map(([dept, employees]) => (
              <div key={dept} className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Building className="h-4 w-4 text-[#225F8B]" />
                    <span className="font-semibold text-[#225F8B] text-sm">{dept}</span>
                  </div>
                  <Badge variant="outline" className="text-xs bg-white">
                    {employees.length} members
                  </Badge>
                </div>
                <div className="ml-4 space-y-1">
                  {employees
                    .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((emp, index) => (
                      <div key={index} className="flex items-center space-x-2 py-1 hover:bg-gray-50 rounded px-2 cursor-pointer"
                           onClick={() => handleEmployeeClick(emp)}> {/* emp here is the full employee object */}
                        <Avatar className="w-6 h-6">
                          {emp.profilePicture && (
                            <img src={emp.profilePicture} alt={emp.name} className="w-full h-full object-cover" />
                          )}
                          <AvatarFallback className="bg-gray-600 text-white text-xs">
                            {emp.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900 truncate">{emp.name}</div>
                          <div className="text-xs text-gray-500 truncate">{emp.designation}</div>
                        </div>
                         <div className={`w-2 h-2 rounded-full ${
                            userStatuses[emp.email] === MOCK_USER_STATUS.ONLINE ? 'bg-green-500' :
                            userStatuses[emp.email] === MOCK_USER_STATUS.BUSY ? 'bg-red-500' : 'bg-gray-400'
                          }`}></div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderChatArea = () => (
    <div className={`flex-1 flex-col bg-white/70 backdrop-blur-sm ${selectedChannel || selectedEmployee ? 'flex' : 'hidden md:flex'}`}>
      <div className="p-4 border-b border-gray-200 bg-white/90">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Back button for mobile */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setSelectedChannel(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {getChannelIcon(selectedChannel)}
            <div>
              <h3 className="font-semibold text-gray-900">{selectedChannel?.name || "Select a Channel"}</h3>
              <p className="text-sm text-gray-600">{selectedChannel?.description || ""}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {selectedChannel?.memberCount || 0} members
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" disabled={!selectedChannel}>
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleDeleteMessages}
                  disabled={!selectedChannel}
                  className="text-red-600 hover:text-red-700 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Chat History
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          {(() => {
            let currentDate = null;
            return getChannelMessages().map((message) => {
              const isSender = message.sender_id === user.email;
              const repliedMessage = message.reply_to ? messages.find(m => m.id === message.reply_to) : null;
              const messageDate = new Date(message.timestamp).toDateString();
              const showHeader = currentDate !== messageDate;
              currentDate = messageDate;
              return (
                <div key={message.id || message.timestamp}>
                  {showHeader && (
                    <div className="text-center text-gray-500 text-sm py-2">
                      {getDateLabel(message.timestamp)}
                    </div>
                  )}
                  <div className={`flex mb-2 ${isSender ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] ${isSender ? 'order-2' : 'order-1'}`}>
                      <div className={`p-3 rounded-lg ${isSender ? 'bg-[#B3D4F2] text-black' : 'bg-white text-gray-900 shadow-sm border border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-sm">{message.sender_name}</span>
                            <span className="text-xs text-gray-500 flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatTime(message.timestamp)}
                            </span>
                            {message.isOptimistic ? (
                              <Clock className="h-3 w-3 text-gray-500" title="Sending..." />
                            ) : (
                              isSender && <MessageStatus status={message.status} />
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleReplyMessage(message)}>
                                Reply
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyMessage(message.content)}>
                                Copy
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {/* Show delete options based on sender/receiver */}
                              {isSender ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteForEveryone(message.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3 mr-2" />
                                    Delete for Everyone
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteForMe(message.id)}
                                    className="text-orange-600 hover:text-orange-700"
                                  >
                                    <Trash2 className="h-3 w-3 mr-2" />
                                    Delete for Me
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleDeleteForMe(message.id)}
                                  className="text-orange-600 hover:text-orange-700"
                                >
                                  <Trash2 className="h-3 w-3 mr-2" />
                                  Delete for Me
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>React</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleEmojiReaction(message.id, '👍')}>
                                👍 Like
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEmojiReaction(message.id, '❤️')}>
                                ❤️ Love
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEmojiReaction(message.id, '😂')}>
                                😂 Laugh
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEmojiReaction(message.id, '😮')}>
                                😮 Wow
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEmojiReaction(message.id, '😢')}>
                                😢 Sad
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {repliedMessage && (
                          <div className="mb-1 p-2 border-l-4 border-blue-500 bg-blue-100 text-xs text-blue-800 rounded">
                            <strong>Replying to {repliedMessage.sender_name}:</strong> {repliedMessage.content}
                          </div>
                        )}
                        <div className={`text-sm ${message.deleted ? 'text-gray-500 italic' : ''}`}>
                          {message.content && <p>{message.content}</p>}
                          {!(message.deleted || message.deleted_for_me) && message.file_url && (
                            <div className="mt-2">
                              <FileMessage message={message} />
                            </div>
                          )}
                        </div>
                      </div>
                      {message.reactions && message.reactions.length > 0 && (
                        <div className={`max-w-[70%] flex flex-wrap gap-1 mt-1 ${isSender ? 'order-3 justify-end' : 'order-2 justify-start'}`} style={{ marginTop: '4px' }}>
                          {Object.entries(
                            message.reactions.reduce((acc, reaction) => {
                              if (!acc[reaction.reaction_type]) {
                                acc[reaction.reaction_type] = { count: 0, users: [] };
                              }
                              acc[reaction.reaction_type].count += 1;
                              acc[reaction.reaction_type].users.push(reaction.user_id); // Assuming user_id is email
                              return acc;
                            }, {})
                          ).map(([emoji, data]) => (
                            <Button
                              key={emoji}
                              variant="outline"
                              size="sm"
                              className={`h-6 px-2 text-xs ${
                                data.users.includes(user.email) ? 'bg-blue-100 border-blue-300' : 'bg-gray-100'
                              }`}
                              onClick={() => handleReactionClick(message, emoji)}
                            >
                              {emoji} {data.count > 1 && data.count}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={!user || !selectedChannel}
        placeholder={selectedChannel ? `Message #${selectedChannel.name}` : "Select a channel to message"}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
      />
    </div>
  );

  const renderPlaceholder = () => (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-white/70 backdrop-blur-sm p-8 text-center">
      <img src={chatImage} alt="Showtime Chat" className="w-64 h-64 object-contain mb-4" />
      <h3 className="text-xl font-semibold text-gray-800">Welcome to Showtime Chat</h3>
      <p className="text-gray-600 mt-2">
        Select a channel or a person from the sidebar to start communicating.
      </p>
    </div>
  );

  if (!user) {
    return (
      <div className="flex justify-center items-center h-full">
        <p>Please log in to use Internal Communication.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Internal Communication</h2>
        <Badge variant="outline" className="bg-[#225F8B]/10 text-[#225F8B] border-[#225F8B]/20">
          {viewMode === 'directChat' ? 'Direct Message' : 'Team Chat & Directory'}
        </Badge>
      </div>

      {viewMode === 'directChat' && selectedEmployee ? (
        <DirectChat 
          selectedEmployee={selectedEmployee} // Pass the full employee object
          onBack={handleBackToChannels}
        />
      ) : !selectedChannel && !selectedEmployee ? (
        <Card className="h-[calc(100vh-200px)] min-h-[600px] overflow-hidden bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <div className="flex h-full">
            {renderSidebar()}
            {renderPlaceholder()}
          </div>
        </Card>
      ) : (
        <Card className="h-[calc(100vh-200px)] min-h-[600px] overflow-hidden bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <div className="flex h-full">
            {renderSidebar()} 
            {selectedChannel ? renderChatArea() : renderPlaceholder()} 
          </div>
        </Card>
      )}
      {reactionPopup.open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[999]">
          
          <div className="bg-white rounded-xl p-4 w-72 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">{reactionPopup.emoji} Reactions</h3>
              <button onClick={() => setReactionPopup({ ...reactionPopup, open: false })}>
                ✖
              </button>
            </div>
      
            <div className="space-y-2 max-h-60 overflow-auto">
              {reactionPopup.users.map((uid) => {
                const userObj = allEmployees?.find(u => u.email === uid) 
                             || { name: uid };
      
                return (
                  <div key={uid} className="flex items-center space-x-3 p-2 border rounded-md">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback>
                        {userObj.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
      
                    <span className="text-sm font-medium">{userObj.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Communication Features - these are static descriptive cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-r from-[#225F8B]/5 to-[#225F8B]/10 border-[#225F8B]/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#225F8B]/10 rounded-full flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-[#225F8B]" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Department Channels</h4>
                <p className="text-sm text-gray-600">Team-specific discussions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-[#225F8B]/5 to-[#225F8B]/10 border-[#225F8B]/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#225F8B]/10 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-[#225F8B]" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Employee Directory</h4>
                <p className="text-sm text-gray-600">Find and connect with colleagues</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-[#225F8B]/5 to-[#225F8B]/10 border-[#225F8B]/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#225F8B]/10 rounded-full flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-[#225F8B]" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Real-time Messaging</h4>
                <p className="text-sm text-gray-600">Instant team communication</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InternalCommunication;
