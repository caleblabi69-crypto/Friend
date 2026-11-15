const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');
const Chat = require('../models/chatModel');
const ai = require('../services/aiService');

exports.list = (req, res) => res.json(Chat.list(req.user.id));
exports.create = (req, res) => res.status(201).json(Chat.create(req.user.id));

exports.get = (req, res) => {
  const chat = Chat.findOwned(Number(req.params.id), req.user.id);
  if (!chat) return res.status(404).json({ error: 'Conversation introuvable.' });
  return res.json({ ...chat, messages: Chat.messages(chat.id) });
};

exports.remove = (req, res) => {
  const chat = Chat.findOwned(Number(req.params.id), req.user.id);
  if (!chat) return res.status(404).json({ error: 'Conversation introuvable.' });
  Chat.delete(chat.id);
  return res.status(204).end();
};

exports.send = async (req, res, next) => {
  const chat = Chat.findOwned(Number(req.params.id), req.user.id);
  if (!chat) return res.status(404).json({ error: 'Conversation introuvable.' });
  const content = String(req.body.content || '').trim();
  const ids = Array.isArray(req.body.attachmentIds) ? req.body.attachmentIds.map(Number) : [];
  if (!content && ids.length === 0) return res.status(400).json({ error: 'Écrivez un message ou ajoutez un fichier.' });
  if (content.length > 20000 || ids.length > 5) return res.status(400).json({ error: 'Message trop long ou trop de pièces jointes (maximum 5).' });

  const placeholders = ids.map(() => '?').join(',');
  const files = ids.length ? db.prepare(
    `SELECT * FROM uploads WHERE user_id = ? AND id IN (${placeholders})`
  ).all(req.user.id, ...ids) : [];
  if (files.length !== ids.length) return res.status(400).json({ error: 'Une pièce jointe est invalide ou inaccessible.' });
  const refs = files.map(({ id, original_name, mime_type }) => ({ id, name: original_name, mimeType: mime_type }));
  const userMessage = Chat.addMessage(chat.id, 'user', content, refs);
  if (chat.title === 'Nouvelle conversation') {
    const title = (content || files[0]?.original_name || 'Nouvelle conversation').slice(0, 64);
    Chat.setTitle(chat.id, title);
  }

  const memories = db.prepare('SELECT content FROM memories WHERE user_id = ? ORDER BY id DESC LIMIT 12').all(req.user.id);
  const plugins = db.prepare('SELECT name, prompt FROM plugins WHERE enabled = 1 ORDER BY id').all();
  const system = [
    'Tu es Friend, un assistant IA utile. Réponds en français sauf demande contraire. Sois clair, précis et honnête.',
    memories.length ? `Mémoire utile sur l’utilisateur:\n${memories.map((m) => `- ${m.content}`).join('\n')}` : '',
    plugins.map((p) => `Extension ${p.name}: ${p.prompt}`).join('\n')
  ].filter(Boolean).join('\n\n');
  const history = Chat.messages(chat.id).slice(-20).map((m) => ({ role: m.role, content: m.content }));
  let userContent = content;
  for (const file of files) {
    if (file.mime_type === 'application/pdf' && file.extracted_text) {
      userContent += `\n\n[Texte extrait de ${file.original_name}]\n${file.extracted_text.slice(0, 30000)}`;
    }
  }
  const images = files.filter((file) => file.mime_type.startsWith('image/')).map((file) => ({
    file,
    data: fs.readFileSync(path.join(require('../config').uploadDir, file.filename)).toString('base64')
  }));
  const messages = [{ role: 'system', content: system }, ...history.slice(0, -1), {
    role: 'user',
    content: images.length ? [
      { type: 'text', text: userContent || 'Décris/analyse cette image.' },
      ...images.map(({ file, data }) => ({ type: 'image_url', image_url: { url: `data:${file.mime_type};base64,${data}` } }))
    ] : (userContent || 'Analyse le fichier joint.')
  }];
  if (images.length && require('../config').aiProvider === 'ollama') {
    messages[messages.length - 1].images = images.map(({ data }) => data);
    messages[messages.length - 1].content = userContent || 'Décris/analyse cette image.';
  }

  const controller = new AbortController();
  let completed = false;
  let answer = '';
  res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`event: user-message\ndata: ${JSON.stringify(userMessage)}\n\n`);
  res.on('close', () => {
    if (!completed && !res.writableEnded) controller.abort();
  });
  try {
    for await (const token of ai.stream(messages, controller.signal)) {
      answer += token;
      res.write(`event: token\ndata: ${JSON.stringify(token)}\n\n`);
    }
    if (answer) Chat.addMessage(chat.id, 'assistant', answer);
    completed = true;
    res.write(`event: done\ndata: ${JSON.stringify({ chatId: chat.id })}\n\n`);
    res.end();
  } catch (error) {
    if (controller.signal.aborted) return;
    completed = true;
    if (answer) Chat.addMessage(chat.id, 'assistant', answer);
    res.write(`event: error\ndata: ${JSON.stringify({ error: error.message || 'Erreur du fournisseur IA.' })}\n\n`);
    res.end();
    if (res.headersSent) return;
    next(error);
  }
};
