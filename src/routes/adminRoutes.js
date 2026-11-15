const express = require('express');
const controller = require('../controllers/adminController');

const router = express.Router();
router.get('/stats', controller.stats);
router.get('/users', controller.users);
router.patch('/users/:id', controller.setUserDisabled);
router.get('/plugins', controller.plugins);
router.post('/plugins', controller.createPlugin);
router.patch('/plugins/:id', controller.updatePlugin);
router.delete('/plugins/:id', controller.deletePlugin);
module.exports = router;
