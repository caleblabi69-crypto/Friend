const db = require('../db');

exports.list = (req, res) => res.json(db.prepare(
  'SELECT id, content, created_at FROM memories WHERE user_id = ? ORDER BY id DESC'
).all(req.user.id));

exports.create = (req, res) => {
  const content = String(req.body.content || '').trim();
  if (!content || content.length > 1000) return res.status(400).json({ error: 'Le souvenir doit contenir de 1 à 1000 caractères.' });
  const result = db.prepare('INSERT INTO memories (user_id, content) VALUES (?, ?)').run(req.user.id, content);
  return res.status(201).json(db.prepare('SELECT id, content, created_at FROM memories WHERE id = ?').get(result.lastInsertRowid));
};

exports.remove = (req, res) => {
  const result = db.prepare('DELETE FROM memories WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  return result.changes ? res.status(204).end() : res.status(404).json({ error: 'Souvenir introuvable.' });
};
