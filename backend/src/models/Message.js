const db = require('../config/db');

const Message = {
  findConversation: async (userId1, userId2) => {
    return await db.Message.findAll({
      where: {
        [db.Sequelize.Op.or]: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 }
        ]
      },
      order: [['sent_at', 'ASC']]
    });
  },

  findByUser: async (userId) => {
    return await db.Message.findAll({
      where: {
        [db.Sequelize.Op.or]: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      order: [['sent_at', 'DESC']]
    });
  },

  findUnread: async (userId) => {
    return await db.Message.findAll({
      where: {
        receiverId: userId,
        isRead: false
      },
      order: [['sent_at', 'ASC']]
    });
  },

  findById: async (id) => {
    return await db.Message.findByPk(id);
  },

  create: async ({ senderId, receiverId, content }) => {
    return await db.Message.create({ senderId, receiverId, content });
  },

  markAsRead: async (messageId) => {
    await db.Message.update(
      { isRead: true },
      { where: { id: messageId } }
    );
  },

  delete: async (id) => {
    const result = await db.Message.destroy({ where: { id } });
    return result > 0;
  },

  lastPerConversation: async (userId) => {
    const [all, unreadAll] = await Promise.all([
      db.Message.findAll({
        where: {
          [db.Sequelize.Op.or]: [{ senderId: userId }, { receiverId: userId }]
        },
        order: [['sent_at', 'DESC']],
      }),
      db.Message.findAll({
        where: { receiverId: userId, isRead: false },
        order: [['sent_at', 'ASC']],
      }),
    ]);

    const unreadByPeer = {};
    for (const msg of unreadAll) {
      const pid = String(msg.senderId);
      if (!unreadByPeer[pid]) unreadByPeer[pid] = [];
      unreadByPeer[pid].push(msg);
    }

    const seen = new Map();
    for (const msg of all) {
      const peerId = String(msg.senderId) === String(userId)
        ? msg.receiverId
        : msg.senderId;
      if (!seen.has(String(peerId))) {
        const peerUnread = unreadByPeer[String(peerId)] || [];
        seen.set(String(peerId), {
          peerId,
          content: msg.content,
          sentAt: msg.sent_at,
          unreadCount: peerUnread.length,
          firstUnreadContent: peerUnread.length > 0 ? peerUnread[0].content : null,
        });
      }
    }
    return Array.from(seen.values());
  },
};

module.exports = Message;
