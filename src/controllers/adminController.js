const db = require('../db');

exports.stats = (_req, res) => {
  res.json({
    users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
    chats: db.prepare('SELECT COUNT(*) AS count FROM chats').get().count,
    messages: db.prepare('SELECT COUNT(*) AS count FROM messages').get().count
  });
};

exports.users = (_req, res) => res.json(db.prepare(
  'SELECT id, email, role, disabled, created_at FROM users ORDER BY id DESC'
).all());

exports.setUserDisabled = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id === req.user.id) return res.status(400).json({ error: 'Action impossible sur ce compte.' });
  const disabled = Boolean(req.body.disabled);
  const result = db.prepare('UPDATE users SET disabled = ? WHERE id = ?').run(disabled ? 1 : 0, id);
  return result.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Utilisateur introuvable.' });
};

exports.plugins = (_req, res) => res.json(db.prepare('SELECT * FROM plugins ORDER BY id DESC').all());
exports.createPlugin = (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80);
  const prompt = String(req.body.prompt || '').trim().slice(0, 2000);
  const description = String(req.body.description || '').trim().slice(0, 300);
  if (!name || !prompt) return res.status(400).json({ error: 'Nom et instructions sont obligatoires.' });
  const result = db.prepare('INSERT INTO plugins (name, description, prompt) VALUES (?, ?, ?)').run(name, description, prompt);
  return res.status(201).json(db.prepare('SELECT * FROM plugins WHERE id = ?').get(result.lastInsertRowid));
};

exports.updatePlugin = (req, res) => {
  const result = db.prepare('UPDATE plugins SET enabled = ? WHERE id = ?').run(req.body.enabled ? 1 : 0, req.params.id);
  return result.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Extension introuvable.' });
};

exports.deletePlugin = (req, res) => {
  const result = db.prepare('DELETE FROM plugins WHERE id = ?').run(req.params.id);
  return result.changes ? res.status(204).end() : res.status(404).json({ error: 'Extension introuvable.' });
};
