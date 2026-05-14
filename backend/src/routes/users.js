const router = require('express').Router();
const { getAll, getOne, create, update, remove } = require('../controllers/userController');
const { requireFields } = require('../middleware/validate');

router.get('/',    getAll);
router.get('/:id', getOne);
router.post('/',   requireFields('fullName', 'email', 'password', 'confirmPassword'), create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
