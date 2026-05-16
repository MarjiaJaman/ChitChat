const router = require('express').Router();
const { upload } = require('../controllers/uploadController');

router.post('/', upload);

module.exports = router;
