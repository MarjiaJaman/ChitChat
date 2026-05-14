const router = require('express').Router();
const { getConversation, getByUser, getUnread } = require('../controllers/messageController');

router.get('/conversation',    getConversation);
router.get('/user/:userId',    getByUser);
router.get('/unread/:userId',  getUnread);

module.exports = router;
