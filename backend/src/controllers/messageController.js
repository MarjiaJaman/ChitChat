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

exports.deleteMessage = async (req, res, next) => {
  try {
    const deleted = await Message.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

exports.getPreviews = async (req, res, next) => {
  try {
    const previews = await Message.lastPerConversation(req.params.userId);
    res.json(previews);
  } catch (err) {
    next(err);
  }
};
