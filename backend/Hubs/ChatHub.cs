using Microsoft.AspNetCore.SignalR;
using ChitChat.Data;
using ChitChat.DTOs;
using ChitChat.Models;
using System.Collections.Concurrent;

namespace ChitChat.Hubs
{
    public class ChatHub : Hub
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<ChatHub> _logger;
        
        // Store user connection mappings (userId -> connectionId)
        private static readonly ConcurrentDictionary<int, string> _userConnections = new();

        public ChatHub(ApplicationDbContext context, ILogger<ChatHub> logger)
        {
            _context = context;
            _logger = logger;
        }

        // Called when a user connects and provides their userId
        public async Task RegisterUser(int userId)
        {
            _userConnections[userId] = Context.ConnectionId;
            _logger.LogInformation("User {UserId} registered with connection {ConnectionId}", userId, Context.ConnectionId);
            
            // Notify others that user is online
            await Clients.Others.SendAsync("UserOnline", userId);
        }

        // Send a message to a specific user
        public async Task SendMessage(SendMessageDto messageDto)
        {
            try
            {
                // Save message to database
                var message = new Message
                {
                    SenderId = messageDto.SenderId,
                    ReceiverId = messageDto.ReceiverId,
                    Content = messageDto.Content,
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                };

                _context.Messages.Add(message);
                await _context.SaveChangesAsync();

                var messageResponse = new MessageDto
                {
                    Id = message.Id,
                    SenderId = message.SenderId,
                    ReceiverId = message.ReceiverId,
                    Content = message.Content,
                    SentAt = message.SentAt,
                    IsRead = message.IsRead
                };

                // Send to receiver if they're online
                if (_userConnections.TryGetValue(messageDto.ReceiverId, out var receiverConnectionId))
                {
                    await Clients.Client(receiverConnectionId).SendAsync("ReceiveMessage", messageResponse);
                }

                // Send confirmation back to sender
                await Clients.Caller.SendAsync("MessageSent", messageResponse);

                _logger.LogInformation("Message sent from {SenderId} to {ReceiverId}", 
                    messageDto.SenderId, messageDto.ReceiverId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending message");
                await Clients.Caller.SendAsync("Error", "Failed to send message");
            }
        }

        // Mark message as read
        public async Task MarkAsRead(int messageId, int userId)
        {
            try
            {
                var message = await _context.Messages.FindAsync(messageId);
                
                if (message != null && message.ReceiverId == userId)
                {
                    message.IsRead = true;
                    await _context.SaveChangesAsync();

                    // Notify sender that message was read
                    if (_userConnections.TryGetValue(message.SenderId, out var senderConnectionId))
                    {
                        await Clients.Client(senderConnectionId).SendAsync("MessageRead", messageId);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking message as read");
            }
        }

        // User is typing indicator
        public async Task UserTyping(int senderId, int receiverId)
        {
            if (_userConnections.TryGetValue(receiverId, out var receiverConnectionId))
            {
                await Clients.Client(receiverConnectionId).SendAsync("UserTyping", senderId);
            }
        }

        // User stopped typing indicator
        public async Task UserStoppedTyping(int senderId, int receiverId)
        {
            if (_userConnections.TryGetValue(receiverId, out var receiverConnectionId))
            {
                await Clients.Client(receiverConnectionId).SendAsync("UserStoppedTyping", senderId);
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            // Find and remove user from connections
            var userId = _userConnections.FirstOrDefault(x => x.Value == Context.ConnectionId).Key;
            
            if (userId != 0)
            {
                _userConnections.TryRemove(userId, out _);
                _logger.LogInformation("User {UserId} disconnected", userId);
                
                // Notify others that user is offline
                await Clients.Others.SendAsync("UserOffline", userId);
            }

            await base.OnDisconnectedAsync(exception);
        }
    }
}
