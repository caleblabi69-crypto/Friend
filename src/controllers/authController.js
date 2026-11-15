const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/userModel');

function issueToken(user) {
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '7d' });
  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

exports.register = async (req, res, next) => {
  try {
    if (!config.allowRegistration) return res.status(403).json({ error: 'Les inscriptions sont désactivées.' });
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    if (password.length < 10) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 10 caractères.' });
    if (User.findByEmail(email)) return res.status(409).json({ error: 'Cette adresse e-mail est déjà utilisée.' });
    const user = User.create(email, await bcrypt.hash(password, 12));
    return res.status(201).json(issueToken(user));
  } catch (error) {
    return next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const user = User.findByEmail(String(req.body.email || '').trim().toLowerCase());
    if (!user || user.disabled || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }
    return res.json(issueToken(user));
  } catch (error) {
    return next(error);
  }
};
