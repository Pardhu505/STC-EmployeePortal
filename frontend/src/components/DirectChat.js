import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import { Card, CardContent, CardHeader } from './ui/card'; // CardTitle not used
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu';
import {
  ArrowLeft,
  Send,
  Clock,
  Check,
  MoreVertical,
  Trash2,
  Paperclip,
  X,
  // Circle // Not using Circle for status indicator here directly, relies on color
} from 'lucide-react';
import { USER_STATUS as MOCK_USER_STATUS } from '../data/mock'; // Renamed for clarity

const MessageStatus = ({ status }) => {
  // Always show at least one tick if the status is 'sent', 'delivered', or 'read'
  if (!['sent', 'delivered', 'read'].includes(status)) {
    return null;
  }
  
  const isRead = status === 'read';
  const isDelivered = status === 'delivered' || isRead;

  return (
    <div className="relative flex items-center w-4 h-4">
      {/* First tick, always present */}
      <Check className={`absolute left-0 h-4 w-4 ${isRead ? 'text-blue-500' : 'text-gray-400'}`} />
      {/* Second tick, for delivered or read status */}
      {isDelivered && (
        <Check className={`absolute left-1 h-4 w-4 ${isRead ? 'text-blue-500' : 'text-gray-400'}`} />
      )}
    </div>
  );
};

const DirectChat = ({ selectedEmployee, onBack }) => {
  const { user, sendWebSocketMessage, userStatuses, setCurrentChatUser, allEmployees, clearChatNotifications } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [reactionPopup, setReactionPopup] = useState({
    open: false,
    emoji: null,
    users: [],
  });

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const recipientId = selectedEmployee?.email; // Get recipient's ID from the 'email' property

  // Set currentChatUser when opening direct chat
  useEffect(() => {
    if (recipientId) {
      setCurrentChatUser(recipientId);
      clearChatNotifications(recipientId, false);
    }
    return () => {
      setCurrentChatUser(null);
    };
  }, [recipientId, setCurrentChatUser, clearChatNotifications]);

  // Fetch old messages when direct chat opens
  useEffect(() => {
    if (user && recipientId) {
      const fetchMessages = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/direct-messages?sender_id=${user.email}&recipient_id=${recipientId}&user_id=${user.email}&limit=50`);
          if (response.ok) {
            let oldMessages = await response.json();
            // Process messages to add the status field
            const processedMessages = oldMessages.map(msg => {
              let status = 'sent'; // Default to sent
              // If the message is from the current user, determine its status based on recipient's actions
              if (msg.sender_id === user.email) {
                if (msg.read_by && msg.read_by.includes(recipientId)) {
                  status = 'read';
                } else if (msg.delivered_to && msg.delivered_to.includes(recipientId)) {
                  status = 'delivered';
                }
              }
              return { ...msg, status };
            });
            setMessages(processedMessages);
          } else {
            console.error('Failed to fetch direct messages:', response.statusText);
          }
        } catch (error) {
          console.error('Error fetching direct messages:', error);
        }
      };
      fetchMessages();
    }
  }, [user, recipientId, user?.email]);

  // WebSocket message handling for direct messages
  useEffect(() => {
    if (user && recipientId) {
      // Request notification permission on mount if not already granted or denied
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('Notification permission:', permission);
        });
      }

      const handleWebSocketMessage = (event) => {
        const incomingMessage = event.detail;
        console.log("DirectChat received WS message:", incomingMessage);

        // CANCEL NOTIFICATION IF USER IS CURRENTLY VIEWING THIS DM
        if (
          incomingMessage.type === "personal_message" &&
          incomingMessage.sender_id === recipientId
        ) {
          // We are inside this chat → skip notifications by stopping further processing in this component
          // The message will still be added to the chat window below.
          // return; // This was the original instruction, but we need to process the message to display it. The check is good for clarity.
        }

        if (incomingMessage.type === 'chat_message' || incomingMessage.type === 'personal_message') {
          // Check if the message is part of this direct chat
          const isFromSenderToRecipient = incomingMessage.sender_id === user.email && incomingMessage.recipient_id === recipientId;
          const isFromRecipientToSender = incomingMessage.sender_id === recipientId && incomingMessage.recipient_id === user.email;

          if (isFromSenderToRecipient || isFromRecipientToSender) {
            setMessages(prevMessages => {
              // Avoid duplicate messages if server echoes back
              // Check by id, or by content + timestamp if id is missing
              const isDuplicate = prevMessages.find(msg =>
                (msg.id && incomingMessage.id && msg.id === incomingMessage.id) ||
                (msg.content === incomingMessage.content &&
                 msg.sender_id === incomingMessage.sender_id &&
                 msg.timestamp === incomingMessage.timestamp)
              );
              if (isDuplicate) {
                console.log("Duplicate message detected, skipping:", incomingMessage);
                return prevMessages;
              }

              return [...prevMessages, incomingMessage];
            });
          } else {
            console.log("Message not for this direct chat, ignoring:", incomingMessage);
          }
        } else if (incomingMessage.type === 'missed_messages') {
          // Handle missed messages sent upon reconnection
          const missedMessages = incomingMessage.messages || [];
          console.log(`DirectChat received ${missedMessages.length} missed messages`);

          setMessages(prev => {
            const newMessages = [...prev];
            missedMessages.forEach(missedMsg => {
              const isDuplicate = newMessages.find(msg => msg.id === missedMsg.id);
              if (!isDuplicate) {
                // Add missed message if it's part of this direct chat
                let status = 'sent';
                if (missedMsg.sender_id === user.email) {
                  if (missedMsg.read_by && missedMsg.read_by.includes(recipientId)) {
                    status = 'read';
                  } else if (missedMsg.delivered_to && missedMsg.delivered_to.includes(recipientId)) {
                    status = 'delivered';
                  }
                }
                const isFromSenderToRecipient = missedMsg.sender_id === user.email && missedMsg.recipient_id === recipientId;
                const isFromRecipientToSender = missedMsg.sender_id === recipientId && missedMsg.recipient_id === user.email;

                if (isFromSenderToRecipient || isFromRecipientToSender) {
                  newMessages.push({ ...missedMsg, status });
                }
              }
            });
            // Sort messages by timestamp to maintain chronological order
            newMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            return newMessages;
          });

        } else if (incomingMessage.type === 'reaction_update') {
          // Handle reaction updates from other users
          console.log("DirectChat received reaction update:", incomingMessage);
          setMessages(prevMessages => prevMessages.map(msg => {
            if (msg.id === incomingMessage.message_id) {
              return { ...msg, reactions: incomingMessage.reactions || [] };
            }
            return msg;
          }));

        } else if (incomingMessage.type === 'message_update') {
          // Handle message updates (like delete for everyone)
          console.log("DirectChat received message update:", incomingMessage);
          setMessages(prev => prev.map(m => m.id === incomingMessage.message_id ? { ...m, deleted: true, content: 'This message was deleted' } : m));
        } else if (incomingMessage.type === 'message_confirmation') {
          // Server confirms message is saved (✔ single tick)
          setMessages(prev => prev.map(m => 
            m.id === incomingMessage.optimistic_id 
              ? { ...m, id: incomingMessage.final_id, timestamp: incomingMessage.timestamp, isOptimistic: false, status: 'sent' } 
              : m
          ));
        } else if (incomingMessage.type === 'delivery_receipt') {
          // Message delivered to recipient (✔✔ double tick)
          setMessages(prev => prev.map(m => 
            m.id === incomingMessage.message_id && m.status !== 'read'
              ? { ...m, status: 'delivered' } 
              : m
          ));
        } else if (incomingMessage.type === 'read_receipt') {
          // Message read by recipient (✔✔ blue tick)
          const messageIdsToUpdate = new Set(incomingMessage.message_ids);
          setMessages(prev => prev.map(m => 
            messageIdsToUpdate.has(m.id)
              ? { ...m, status: 'read' } 
              : m
          ));
        } else if (incomingMessage.type === 'mark_messages_read') {
          // When the other user reads our messages, we need to inform the server
          // so it can update the database and notify the sender.
          // This client-side logic sends the read confirmation.
          const messageIdsToMark = incomingMessage.message_ids || [];
          if (messageIdsToMark.length > 0) {
            sendWebSocketMessage({
              type: 'mark_messages_read',
              message_ids: messageIdsToMark,
              chat_partner_id: incomingMessage.chat_partner_id, // The original sender
            });
          }
        }
        // Status updates are handled by AuthContext and reflected via userStatuses prop
      };

      console.log("Setting up WebSocket listener for direct chat:", { userId: user.email, recipientId });
      window.addEventListener('websocket-message', handleWebSocketMessage);
      return () => {
        console.log("Cleaning up WebSocket listener for direct chat");
        window.removeEventListener('websocket-message', handleWebSocketMessage);
      };
    }
  }, [user, recipientId, sendWebSocketMessage]);

  // Mark messages as read when chat is opened or new messages arrive
  useEffect(() => {
    const unreadMessages = messages.filter(
      (msg) => msg.sender_id === recipientId && (!msg.read_by || !msg.read_by.includes(user.email))
    );

    if (unreadMessages.length > 0) {
      const messageIds = unreadMessages.map((msg) => msg.id);
      sendWebSocketMessage({
        type: 'mark_messages_read',
        message_ids: messageIds,
        chat_partner_id: recipientId, // The person who sent these messages
      });
    }
  }, [messages, recipientId, user.email, sendWebSocketMessage]);


  // Scroll to bottom when messages change and trigger notifications
  useEffect(() => {
    const chatContainer = messagesEndRef.current?.parentElement;
    if (!chatContainer) return;

    // Only auto-scroll if the user is already near the bottom
    const isScrolledToBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 100;

    if (isScrolledToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]); // Dependency array simplified to just `messages`




  const handleSendMessage = async () => {
    if ((newMessage.trim() || selectedFile) && user && recipientId) {
      let fileData = null;
      if (selectedFile) {
        try {
          const formData = new FormData();
          formData.append('file', selectedFile);

          const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            fileData = await response.json();
            console.log('File uploaded successfully:', fileData);
          } else {
            console.error('File upload failed:', response.statusText);
            alert('File upload failed. Please try again.');
            return;
          }
        } catch (error) {
          console.error('Error uploading file:', error);
          alert('Error uploading file. Please try again.');
          return;
        }
      }

      const messagePayload = {
        type: 'personal_message',
        recipient_id: recipientId,
        sender_id: user.email,
        sender_name: user.name,
        content: newMessage || (fileData ? `${fileData.file_name} (${(fileData.file_size / 1024).toFixed(1)} KB)` : ''),
        reply_to: replyTo ? replyTo.id : null,
        file_url: fileData ? fileData.file_url : null,
        file_name: fileData ? fileData.file_name : null,
        file_type: fileData ? fileData.file_type : null,
        file_size: fileData ? fileData.file_size : null,
        id: `optimistic-${Date.now()}`, // Add optimistic ID
        // timestamp and id will be added by backend
      };
      sendWebSocketMessage(messagePayload);

      // Optimistically add the message to the state for immediate display
      const optimisticMessage = {
        id: `optimistic-${Date.now()}`,
        optimistic_id: messagePayload.id, // Keep track of the ID sent to the server
        sender_id: user.email,
        sender_name: user.name,
        content: newMessage || (fileData ? `${fileData.file_name} (${(fileData.file_size / 1024).toFixed(1)} KB)` : ''),
        reply_to: replyTo ? replyTo.id : null,
        file_url: fileData ? fileData.file_url : null,
        file_name: fileData ? fileData.file_name : null,
        file_type: fileData ? fileData.file_type : null,
        file_size: fileData ? fileData.file_size : null,
        timestamp: new Date().toISOString(),
        recipient_id: recipientId,
        type: 'personal_message',
        isOptimistic: true,
        status: 'sending', // Initial status
      };
      setMessages(prevMessages => [...prevMessages, optimisticMessage]);

      setNewMessage('');
      setSelectedFile(null);
      setReplyTo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Delete only for me
const handleDeleteForMe = async (messageId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}/delete?user_id=${user.email}`, {
      method: 'POST',
    });
    if (response.ok) {
      setMessages(messages.map(msg =>
        msg.id === messageId
          ? { ...msg, deleted_for_me: true }
          : msg
      ));
    } else {
      alert('Failed to delete message.');
    }
  } catch (error) {
    console.error('Error deleting message for me:', error);
    alert('Error deleting message.');
  }
};

// Delete for everyone
const handleDeleteForEveryone = async (messageId) => {
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

// Clear direct chat
const handleClearChat = async () => {
  if (!window.confirm("Are you sure you want to clear this chat for yourself?")) return;
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/direct-messages/clear-for-user?sender_id=${user.email}&recipient_id=${recipientId}&user_id=${user.email}`,
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
  

  const canDeleteForEveryone = (message) => {
    // Don't allow deletion of optimistic messages (still being sent)
    if (!message.id || message.id.startsWith("optimistic-")) return false;
    if (message.sender_id !== user.email) return false;
    // Allow deletion of any message sent by the current user (no time limit)
    return true;
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

  const handleCopyMessage = (message) => {
    navigator.clipboard.writeText(message.content);
  };

  const handleEmojiReaction = (messageId, emoji) => {
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

  const getStatusColor = useCallback((statusKey) => {
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

  const employeeStatus = recipientId ? (userStatuses[recipientId] || MOCK_USER_STATUS.OFFLINE) : MOCK_USER_STATUS.OFFLINE;

  if (!selectedEmployee) {
    return <div className="p-4">No employee selected for direct chat.</div>;
  }
  if (!user) {
     return <div className="p-4">Please log in to chat.</div>;
  }

  return (
    <Card className="h-[calc(100vh-200px)] min-h-[600px] overflow-hidden bg-white/80 backdrop-blur-sm border-0 shadow-xl">
      <CardHeader className="p-4 border-b border-gray-200 bg-white/90">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
              <Avatar className="w-10 h-10">
                {selectedEmployee.profilePicture && (
                  <img src={selectedEmployee.profilePicture} alt={selectedEmployee.name} className="w-full h-full object-cover" />
                )}
                <AvatarFallback className="bg-[#225F8B] text-white">
                  {selectedEmployee.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className={`absolute -bottom-0 -right-0 w-3 h-3 border-2 border-white rounded-full ${
                employeeStatus === MOCK_USER_STATUS.ONLINE ? 'bg-green-500' :
                employeeStatus === MOCK_USER_STATUS.BUSY ? 'bg-red-500' : 'bg-gray-400'
              }`}></div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{selectedEmployee.name}</h3>
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <span>{selectedEmployee.designation}</span>
                <span aria-hidden="true">•</span>
                <span>{selectedEmployee.department}</span>
                <span className={`text-xs ${getStatusColor(employeeStatus)}`}>
                  <span aria-hidden="true">•</span> {getStatusText(employeeStatus)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-[#225F8B]/10 text-[#225F8B]">
              Direct Message
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              title="Clear Chat"
              onClick={handleClearChat}
              className="p-1 text-red-600 hover:text-red-800"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex flex-col h-[calc(100%-73px)]">
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>Start a conversation with {selectedEmployee.name}.</p>
                <p className="text-xs">Messages are end-to-end NOT encrypted.</p>
              </div>
            ) : (
              (() => {
                let currentDate = null;
                return messages
                  .filter(
                    (message) =>
                      !message.deleted_for_me && // Hide if deleted for me
                      !(message.deleted_for && message.deleted_for.includes && message.deleted_for.includes(user.email))
                  )
                  .map((message) => {
                    const isSender = message.sender_id === user.email;
                    const repliedMessage = message.reply_to ? messages.find(m => m.id === message.reply_to) : null;

                    // For deleted for everyone, show "This message was deleted"
                    const displayContent = message.deleted
                      ? 'This message was deleted'
                      : message.content;

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
                        <div
                          className={`flex mb-2 ${isSender ? 'justify-end' : 'justify-start'}`}
                        >
                          {isSender ? (
                            <div className="flex flex-col items-end">
                              <div className={`order-2 p-3 rounded-lg bg-[#B3D4F2] text-black inline-block max-w-max max-h-max`}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium text-sm text-gray-900">{message.sender_name}</span>
                                    <span className="text-xs text-gray-500 flex items-center">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {formatTime(message.timestamp)}
                                    </span>
                                    {message.isOptimistic ? (
                                      <Clock className="h-3 w-3 text-gray-500" title="Sending..." />
                                    ) : (
                                      <MessageStatus status={message.status} />
                                    )}
                                  </div>
                                  {!message.deleted && !message.deleted_for_me && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                          <MoreVertical className="h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() => handleReplyMessage(message)}
                                        >
                                          Reply
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleCopyMessage(message.content)}
                                        >
                                          Copy
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleDeleteForMe(message.id)}
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          <Trash2 className="h-3 w-3 mr-2" />
                                          Delete for me
                                        </DropdownMenuItem>
                                        {canDeleteForEveryone(message) && (
                                          <DropdownMenuItem
                                            onClick={() => handleDeleteForEveryone(message.id)}
                                            className="text-red-600 hover:text-red-700"
                                          >
                                            <Trash2 className="h-3 w-3 mr-2" />
                                            Delete for everyone
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => handleEmojiReaction(message.id, '👍')}
                                        >
                                          👍
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleEmojiReaction(message.id, '❤️')}
                                        >
                                          ❤️
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleEmojiReaction(message.id, '😂')}
                                        >
                                          😂
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleEmojiReaction(message.id, '😮')}
                                        >
                                          😮
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleEmojiReaction(message.id, '😢')}
                                        >
                                          😢
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                                {repliedMessage && (
                                  <div className="mb-1 p-2 border-l-4 border-blue-500 bg-blue-100 text-xs text-blue-800 rounded">
                                    <strong>Replying to {repliedMessage.sender_name}:</strong> {repliedMessage.content}
                                  </div>
                                )}
                                <div className={`text-sm ${(message.deleted || message.deleted_for_me) ? 'text-gray-400 italic' : ''}`}>
                                  {displayContent && <p>{(message.deleted || message.deleted_for_me) ? 'This message was deleted' : displayContent}</p>}
                                  {!(message.deleted || message.deleted_for_me) && (message.file || message.file_url) && (
                                    <div className="mt-2 p-2 bg-gray-100 rounded border">
                                      {/* <div className="flex items-center space-x-2">
                                        <Paperclip className="h-4 w-4 text-gray-500" />
                                        <span className="text-sm font-medium">
                                          {message.file?.name || message.file_name}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          ({((message.file?.size || message.file_size) / 1024).toFixed(1)} KB)
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-600 mt-1">
                                        {message.file?.type || message.file_type}
                                      </p> */}
                                      {message.file_url && (
                                        <a
                                          href={message.file_url}
                                          download={message.file_name}
                                          className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
                                        >
                                          Download File
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {message.reactions && message.reactions.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1 justify-end">
                                  {Object.entries(
                                    message.reactions.reduce((acc, reaction) => {
                                      if (!acc[reaction.reaction_type]) {
                                        acc[reaction.reaction_type] = { count: 0, users: [] };
                                      }
                                      acc[reaction.reaction_type].count += 1;
                                      acc[reaction.reaction_type].users.push(reaction.user_id);
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
                          ) : (
                            <div className="flex flex-col items-start">
                              <div className="order-2 p-3 rounded-lg bg-gray-200 text-gray-900 inline-block max-w-max max-h-max">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium text-sm">{message.sender_name}</span>
                                    <span className="text-xs text-gray-500 flex items-center">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {formatTime(message.timestamp)}
                                    </span>
                                  </div>
                                  {!message.deleted && !message.deleted_for_me && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                          <MoreVertical className="h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() => handleReplyMessage(message)}
                                        >
                                          Reply
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleCopyMessage(message.content)}
                                        >
                                          Copy
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleDeleteForMe(message.id)}
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          <Trash2 className="h-3 w-3 mr-2" />
                                          Delete for me
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => handleEmojiReaction(message.id, '👍')}
                                        >
                                          👍
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleEmojiReaction(message.id, '❤️')}
                                        >
                                          ❤️
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleEmojiReaction(message.id, '😂')}
                                        >
                                          😂
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleEmojiReaction(message.id, '😮')}
                                        >
                                          😮
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleEmojiReaction(message.id, '😢')}
                                        >
                                          😢
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                                {repliedMessage && (
                                  <div className="mb-1 p-2 border-l-4 border-blue-500 bg-blue-100 text-xs text-blue-800 rounded">
                                    <strong>Replying to {repliedMessage.sender_name}:</strong> {repliedMessage.content}
                                  </div>
                                )}
                                <div className={`text-sm ${(message.deleted || message.deleted_for_me) ? 'text-gray-400 italic' : ''}`}>

                                  {displayContent && <p>{(message.deleted || message.deleted_for_me) ? 'This message was deleted' : displayContent}</p>}
                                  {!(message.deleted || message.deleted_for_me) && (message.file || message.file_url) && (
                                    <div className="mt-2 p-2 bg-gray-100 rounded border">
                                      <div className="flex items-center space-x-2">
                                        <Paperclip className="h-4 w-4 text-gray-500" />
                                        <span className="text-sm font-medium">
                                          {message.file?.name || message.file_name}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          ({((message.file?.size || message.file_size) / 1024).toFixed(1)} KB)
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-600 mt-1">
                                        {message.file?.type || message.file_type}
                                      </p>
                                      {message.file_url && (
                                        <a
                                          href={message.file_url}
                                          download={message.file_name}
                                          className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
                                        >
                                          Download File
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {message.reactions && message.reactions.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1 justify-start">
                                  {Object.entries(
                                    message.reactions.reduce((acc, reaction) => {
                                      if (!acc[reaction.reaction_type]) {
                                        acc[reaction.reaction_type] = { count: 0, users: [] };
                                      }
                                      acc[reaction.reaction_type].count += 1;
                                      acc[reaction.reaction_type].users.push(reaction.user_id);
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
                          )}
                        </div>
                      </div>
                    );
                  });
              })()
              )}
            <div ref={messagesEndRef} />
          </div>
        </div>

      <div className="p-4 border-t border-gray-200 bg-white/90">
        {replyTo && (
          <div className="mb-2 p-2 bg-blue-50 border-l-4 border-blue-500 rounded flex items-center justify-between">
            <div className="text-sm text-blue-800">
              <strong>Replying to {replyTo.sender_name}:</strong> {replyTo.content}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplyTo(null)}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            placeholder={replyTo ? `Reply to ${replyTo.sender_name}` : `Message ${selectedEmployee.name}`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1"
            disabled={!user || !recipientId}
          />
          <Button
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !selectedFile) || !user || !recipientId}
            className="bg-[#225F8B] hover:bg-[#225F8B]/90"
          >
            <Send className="h-4 w-4" />
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setSelectedFile(e.target.files[0]);
              }
            }}
            style={{ display: 'none' }}
            accept="*/*" // <-- Allow all file types
          />
        </div>
        {selectedFile && (
          <div className="mt-2 p-2 bg-gray-100 rounded border flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Paperclip className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">{selectedFile.name}</span>
              <span className="text-xs text-gray-500">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      </CardContent>
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
    </Card>
  );
};

export default DirectChat;
