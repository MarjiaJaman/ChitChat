import React, { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';

const ChatComponent = ({ currentUserId }) => {
    const [connection, setConnection] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef(null);

    // Initialize SignalR connection
    useEffect(() => {
        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl('http://localhost:5000/chatHub')
            .withAutomaticReconnect()
            .build();

        setConnection(newConnection);
    }, []);

    // Start connection and set up event listeners
    useEffect(() => {
        if (connection) {
            connection.start()
                .then(() => {
                    console.log('Connected to SignalR');
                    // Register current user
                    connection.invoke('RegisterUser', currentUserId);

                    // Listen for incoming messages
                    connection.on('ReceiveMessage', (message) => {
                        setMessages(prev => [...prev, message]);
                        // Optionally play notification sound
                    });

                    // Listen for message sent confirmation
                    connection.on('MessageSent', (message) => {
                        setMessages(prev => [...prev, message]);
                    });

                    // Listen for user status changes
                    connection.on('UserOnline', (userId) => {
                        setOnlineUsers(prev => new Set([...prev, userId]));
                    });

                    connection.on('UserOffline', (userId) => {
                        setOnlineUsers(prev => {
                            const updated = new Set(prev);
                            updated.delete(userId);
                            return updated;
                        });
                    });

                    // Listen for typing indicators
                    connection.on('UserTyping', (userId) => {
                        if (userId === selectedUserId) {
                            setIsTyping(true);
                        }
                    });

                    connection.on('UserStoppedTyping', (userId) => {
                        if (userId === selectedUserId) {
                            setIsTyping(false);
                        }
                    });

                    // Listen for message read receipts
                    connection.on('MessageRead', (messageId) => {
                        setMessages(prev => prev.map(msg => 
                            msg.id === messageId ? { ...msg, isRead: true } : msg
                        ));
                    });
                })
                .catch(err => console.error('Connection error:', err));
        }

        return () => {
            if (connection) {
                connection.stop();
            }
        };
    }, [connection, currentUserId, selectedUserId]);

    // Load conversation history
    useEffect(() => {
        if (selectedUserId) {
            fetch(`http://localhost:5000/api/messages/conversation?userId1=${currentUserId}&userId2=${selectedUserId}`)
                .then(res => res.json())
                .then(data => setMessages(data))
                .catch(err => console.error('Error loading messages:', err));
        }
    }, [selectedUserId, currentUserId]);

    // Send message
    const sendMessage = async () => {
        if (messageInput.trim() && connection && selectedUserId) {
            try {
                await connection.invoke('SendMessage', {
                    senderId: currentUserId,
                    receiverId: selectedUserId,
                    content: messageInput
                });
                setMessageInput('');
                
                // Stop typing indicator
                await connection.invoke('UserStoppedTyping', currentUserId, selectedUserId);
            } catch (err) {
                console.error('Error sending message:', err);
            }
        }
    };

    // Handle typing
    const handleTyping = async (e) => {
        setMessageInput(e.target.value);

        if (connection && selectedUserId) {
            // Send typing indicator
            await connection.invoke('UserTyping', currentUserId, selectedUserId);

            // Clear previous timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Set timeout to send "stopped typing" after 2 seconds
            typingTimeoutRef.current = setTimeout(async () => {
                await connection.invoke('UserStoppedTyping', currentUserId, selectedUserId);
            }, 2000);
        }
    };

    // Mark message as read when viewing
    const markAsRead = async (messageId) => {
        if (connection) {
            try {
                await connection.invoke('MarkAsRead', messageId, currentUserId);
            } catch (err) {
                console.error('Error marking message as read:', err);
            }
        }
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                <h2>Real-Time Messenger</h2>
                <span className="online-count">
                    {onlineUsers.size} online
                </span>
            </div>

            <div className="chat-messages">
                {messages.map((msg) => (
                    <div 
                        key={msg.id} 
                        className={`message ${msg.senderId === currentUserId ? 'sent' : 'received'}`}
                        onMouseEnter={() => {
                            if (msg.receiverId === currentUserId && !msg.isRead) {
                                markAsRead(msg.id);
                            }
                        }}
                    >
                        <div className="message-content">{msg.content}</div>
                        <div className="message-meta">
                            <span className="timestamp">
                                {new Date(msg.sentAt).toLocaleTimeString()}
                            </span>
                            {msg.senderId === currentUserId && (
                                <span className={`read-status ${msg.isRead ? 'read' : 'unread'}`}>
                                    {msg.isRead ? '✓✓' : '✓'}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="typing-indicator">
                        <span>User is typing...</span>
                    </div>
                )}
            </div>

            <div className="chat-input">
                <input
                    type="text"
                    value={messageInput}
                    onChange={handleTyping}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                />
                <button onClick={sendMessage}>Send</button>
            </div>
        </div>
    );
};

export default ChatComponent;
