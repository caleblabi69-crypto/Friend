require('dotenv').config();
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
const { authenticate, requireAdmin } = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const uploadController = require('./controllers/uploadController');
const memoryController = require('./controllers/memoryController');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: config.isProduction
    ? { directives: { scriptSrc: ["'self'", "'unsafe-inline'"] } }
    : false
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', provider: config.aiProvider }));
app.use('/api/auth', authRoutes);
app.use('/api/chats', authenticate, chatRoutes);
app.post('/api/uploads', authenticate, uploadController.upload);
app.get('/api/memories', authenticate, memoryController.list);
app.post('/api/memories', authenticate, memoryController.create);
app.delete('/api/memories/:id', authenticate, memoryController.remove);
app.use('/api/admin', authenticate, requireAdmin, adminRoutes);
app.get('/api/config', (_req, res) => res.json({
  registrationEnabled: config.allowRegistration,
  provider: config.aiProvider
}));

const swaggerDocument = {
  openapi: '3.0.3',
  info: { title: 'Friend API', version: '1.0.0', description: 'API de l’assistant conversationnel Friend.' },
  servers: [{ url: '/api' }],
  paths: {
    '/health': { get: { summary: 'État du service', responses: { 200: { description: 'Service disponible' } } } },
    '/auth/register': { post: { summary: 'Créer un compte', responses: { 201: { description: 'Compte créé' } } } },
    '/auth/login': { post: { summary: 'Se connecter', responses: { 200: { description: 'Session ouverte' } } } },
    '/chats': { get: { summary: 'Lister les conversations', responses: { 200: { description: 'Conversations' } } }, post: { summary: 'Créer une conversation', responses: { 201: { description: 'Conversation créée' } } } },
    '/chats/{id}/messages': { post: { summary: 'Envoyer un message (réponse SSE)', responses: { 200: { description: 'Flux Server-Sent Events' } } } },
    '/uploads': { post: { summary: 'Téléverser un PDF ou une image', responses: { 201: { description: 'Fichiers acceptés' } } } },
    '/memories': { get: { summary: 'Lister les souvenirs', responses: { 200: { description: 'Souvenirs' } } }, post: { summary: 'Ajouter un souvenir', responses: { 201: { description: 'Souvenir créé' } } } }
  }
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

if (config.isProduction) {
  const clientDist = path.resolve(__dirname, '../frontend/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    return res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  if (res.headersSent) return res.end();
  return res.status(500).json({ error: 'Une erreur serveur est survenue.' });
});

if (require.main === module) {
  app.listen(config.port, '0.0.0.0', () => console.log(`Friend API active sur le port ${config.port}`));
}
module.exports = app;
