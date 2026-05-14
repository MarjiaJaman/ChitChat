const router = require('express').Router();
const { login } = require('../controllers/authController');
const { requireFields } = require('../middleware/validate');

router.post('/login', requireFields('email', 'password'), login);

module.exports = router;
