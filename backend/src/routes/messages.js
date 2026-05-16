const router = require('express').Router();
const { getConversation, getByUser, getUnread, deleteMessage, getPreviews } = require('../controllers/messageController');

router.get('/conversation',      getConversation);
router.get('/previews/:userId',  getPreviews);
router.get('/user/:userId',      getByUser);
router.get('/unread/:userId',    getUnread);
router.delete('/:id',            deleteMessage);

module.exports = router;
