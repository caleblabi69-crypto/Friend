const db = require('../db');

module.exports = {
  list(userId) {
    return db.prepare(`
      SELECT c.id, c.title, c.created_at, c.updated_at,
        (SELECT content FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) AS last_message
      FROM chats c WHERE c.user_id = ? ORDER BY c.updated_at DESC
    `).all(userId);
  },
  create(userId, title = 'Nouvelle conversation') {
    const result = db.prepare('INSERT INTO chats (user_id, title) VALUES (?, ?)').run(userId, title);
    return db.prepare('SELECT * FROM chats WHERE id = ?').get(result.lastInsertRowid);
  },
  findOwned(id, userId) {
    return db.prepare('SELECT * FROM chats WHERE id = ? AND user_id = ?').get(id, userId);
  },
  messages(chatId) {
    return db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY id').all(chatId)
      .map((message) => ({ ...message, attachments: JSON.parse(message.attachments) }));
  },
  addMessage(chatId, role, content, attachments = []) {
    db.exec('BEGIN');
    try {
      const result = db.prepare(
        'INSERT INTO messages (chat_id, role, content, attachments) VALUES (?, ?, ?, ?)'
      ).run(chatId, role, content, JSON.stringify(attachments));
      db.prepare('UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(chatId);
      db.exec('COMMIT');
      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      return { ...message, attachments: JSON.parse(message.attachments) };
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  },
  setTitle(id, title) {
    db.prepare('UPDATE chats SET title = ? WHERE id = ?').run(title, id);
  },
  delete(id) {
    db.prepare('DELETE FROM chats WHERE id = ?').run(id);
  }
};
