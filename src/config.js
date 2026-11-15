const path = require('node:path');

module.exports = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-before-deploying',
  databasePath: path.resolve(process.env.DATABASE_PATH || './data/friend.sqlite'),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  maxUploadBytes: (Number(process.env.MAX_UPLOAD_MB) || 15) * 1024 * 1024,
  allowRegistration: process.env.ALLOW_REGISTRATION !== 'false',
  aiProvider: process.env.AI_PROVIDER || 'ollama',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3',
  aiBaseUrl: process.env.AI_BASE_URL || '',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || '',
  isProduction: process.env.NODE_ENV === 'production'
};

if (module.exports.isProduction && (
  module.exports.jwtSecret === 'development-secret-change-before-deploying' ||
  Buffer.byteLength(module.exports.jwtSecret) < 32
)) {
  throw new Error('JWT_SECRET doit être défini en production avec au moins 32 octets.');
}
