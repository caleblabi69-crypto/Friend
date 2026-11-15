const express = require('express');
const controller = require('../controllers/chatController');

const router = express.Router();
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.get);
router.delete('/:id', controller.remove);
router.post('/:id/messages', controller.send);
module.exports = router;
