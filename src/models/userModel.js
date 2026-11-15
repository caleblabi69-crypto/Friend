const db = require('../db');

module.exports = {
  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },
  findById(id) {
    return db.prepare('SELECT id, email, role, disabled, created_at FROM users WHERE id = ?').get(id);
  },
  create(email, passwordHash) {
    const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, passwordHash);
    return this.findById(result.lastInsertRowid);
  }
};
