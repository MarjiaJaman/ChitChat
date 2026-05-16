const Message = require('../models/Message');

const userConnections = new Map();

function registerChatHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('registerUser', (userId) => {
      userConnections.set(userId, socket.id);
      socket.userId = userId;
      socket.broadcast.emit('userOnline', userId);
    });

    socket.on('sendMessage', async ({ senderId, receiverId, content }) => {
      try {
        const message = await Message.create({ senderId, receiverId, content });
        const receiverSocketId = userConnections.get(receiverId);
        if (receiverSocketId) io.to(receiverSocketId).emit('receiveMessage', message);
        socket.emit('messageSent', message);
      } catch (err) {
        console.error('Error sending message:', err);
        socket.emit('error', 'Failed to send message');
      }
    });

    socket.on('markAsRead', async ({ messageId, userId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.receiverId !== userId) return;
        await Message.markAsRead(messageId);
        const senderSocketId = userConnections.get(message.senderId);
        if (senderSocketId) io.to(senderSocketId).emit('messageRead', messageId);
      } catch (err) {
        console.error('Error marking message as read:', err);
      }
    });

    socket.on('userTyping', ({ senderId, receiverId }) => {
      const receiverSocketId = userConnections.get(receiverId);
      if (receiverSocketId) io.to(receiverSocketId).emit('userTyping', senderId);
    });

    socket.on('userStoppedTyping', ({ senderId, receiverId }) => {
      const receiverSocketId = userConnections.get(receiverId);
      if (receiverSocketId) io.to(receiverSocketId).emit('userStoppedTyping', senderId);
    });

    // ── Audio call signaling ──────────────────────────
    socket.on('callUser', ({ callerId, receiverId, callerName, callerPhoto, offer }) => {
      const receiverSocketId = userConnections.get(String(receiverId));
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('incomingCall', { callerId, callerName, callerPhoto, offer });
      } else {
        socket.emit('callUnavailable');
      }
    });

    socket.on('callAnswer', ({ callerId, answer }) => {
      const callerSocketId = userConnections.get(String(callerId));
      if (callerSocketId) io.to(callerSocketId).emit('callAnswered', { answer });
    });

    socket.on('callReject', ({ callerId }) => {
      const callerSocketId = userConnections.get(String(callerId));
      if (callerSocketId) io.to(callerSocketId).emit('callRejected');
    });

    socket.on('callEnd', ({ peerId }) => {
      const peerSocketId = userConnections.get(String(peerId));
      if (peerSocketId) io.to(peerSocketId).emit('callEnded');
    });

    socket.on('iceCandidate', ({ peerId, candidate }) => {
      const peerSocketId = userConnections.get(String(peerId));
      if (peerSocketId) io.to(peerSocketId).emit('iceCandidate', { candidate });
    });

    socket.on('disconnect', () => {
      if (socket.userId !== undefined) {
        userConnections.delete(socket.userId);
        socket.broadcast.emit('userOffline', socket.userId);
      }
    });
  });
}

module.exports = registerChatHandlers;
