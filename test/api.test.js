const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'friend-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(dataDir, 'friend.sqlite');
process.env.UPLOAD_DIR = path.join(dataDir, 'uploads');
process.env.JWT_SECRET = 'test-secret-with-enough-entropy';
process.env.ALLOW_REGISTRATION = 'true';
process.env.ADMIN_EMAIL = 'admin@example.test';
process.env.ADMIN_PASSWORD = 'admin-password-123';

const app = require('../src/server');
const db = require('../src/db');
let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function api(url, { token, ...options } = {}) {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${url}`, { ...options, headers });
  return { response, body: response.status === 204 ? null : await response.json() };
}

test('health, authentication, private chats, memories, and admin access', async () => {
  const health = await api('/api/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.status, 'ok');

  const guestChats = await api('/api/chats');
  assert.equal(guestChats.response.status, 401);

  const invalid = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: 'not-an-email', password: 'short' })
  });
  assert.equal(invalid.response.status, 400);

  const created = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: 'User@example.test', password: 'user-password-123' })
  });
  assert.equal(created.response.status, 201);
  const userToken = created.body.token;

  const duplicate = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.test', password: 'user-password-123' })
  });
  assert.equal(duplicate.response.status, 409);

  const second = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: 'second@example.test', password: 'second-password-123' })
  });
  const chat = await api('/api/chats', { token: userToken, method: 'POST', body: '{}' });
  assert.equal(chat.response.status, 201);

  const nativeFetch = global.fetch;
  global.fetch = async (input, options) => {
    if (String(input) === 'http://127.0.0.1:11434/api/chat') {
      return new Response('{"message":{"content":"Bonjour !"}}\n', {
        headers: { 'Content-Type': 'application/x-ndjson' }
      });
    }
    return nativeFetch(input, options);
  };
  try {
    const streamResponse = await fetch(`${baseUrl}/api/chats/${chat.body.id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Bonjour' })
    });
    const streamBody = await streamResponse.text();
    assert.equal(streamResponse.status, 200);
    assert.match(streamBody, /event: token/);
    assert.match(streamBody, /event: done/);
  } finally {
    global.fetch = nativeFetch;
  }

  const storedChat = await api(`/api/chats/${chat.body.id}`, { token: userToken });
  assert.equal(storedChat.body.messages[1].content, 'Bonjour !');

  const privateChat = await api(`/api/chats/${chat.body.id}`, { token: second.body.token });
  assert.equal(privateChat.response.status, 404);

  const memory = await api('/api/memories', {
    token: userToken,
    method: 'POST',
    body: JSON.stringify({ content: 'Réponses concises.' })
  });
  assert.equal(memory.response.status, 201);
  assert.equal(memory.body.content, 'Réponses concises.');

  const admin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@example.test', password: 'admin-password-123' })
  });
  assert.equal(admin.response.status, 200);
  assert.equal(admin.body.user.role, 'admin');
  const stats = await api('/api/admin/stats', { token: admin.body.token });
  assert.equal(stats.response.status, 200);
  assert.equal(stats.body.chats, 1);
  assert.equal(stats.body.messages, 2);
});
