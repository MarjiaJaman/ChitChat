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
};

module.exports = Message;
