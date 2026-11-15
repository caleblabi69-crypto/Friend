const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

function authenticate(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Authentification requise.' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT id, email, role, disabled FROM users WHERE id = ?').get(payload.sub);
    if (!user || user.disabled) return res.status(401).json({ error: 'Compte indisponible.' });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Accès réservé à l’administration.' });
  return next();
}

module.exports = { authenticate, requireAdmin };
