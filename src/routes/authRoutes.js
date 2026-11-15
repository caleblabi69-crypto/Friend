const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authController');

const router = express.Router();
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
router.post('/register', loginLimit, controller.register);
router.post('/login', loginLimit, controller.login);
module.exports = router;
