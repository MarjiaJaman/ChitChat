const Message = require('../models/Message');

exports.getConversation = async (req, res, next) => {
  try {
    const { userId1, userId2 } = req.query;
    const messages = await Message.findConversation(userId1, userId2);
    res.json(messages);
  } catch (err) {
    next(err);
  }
};

exports.getByUser = async (req, res, next) => {
  try {
    const messages = await Message.findByUser(req.params.userId);
    res.json(messages);
  } catch (err) {
    next(err);
  }
};

exports.getUnread = async (req, res, next) => {
  try {
    const messages = await Message.findUnread(req.params.userId);
    res.json(messages);
  } catch (err) {
    next(err);
  }
};
