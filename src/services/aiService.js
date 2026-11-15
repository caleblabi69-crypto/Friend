const config = require('../config');

function endpoint(base, suffix) {
  return `${base.replace(/\/+$/, '')}/${suffix}`;
}

async function* ollamaStream(messages, signal) {
  const response = await fetch(endpoint(config.ollamaBaseUrl, 'api/chat'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.ollamaModel, messages, stream: true }),
    signal
  });
  if (!response.ok) throw new Error(`Ollama a répondu ${response.status}. Vérifiez qu’il est démarré et que le modèle est installé.`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line);
      if (chunk.message?.content) yield chunk.message.content;
    }
  }
}

async function* compatibleStream(messages, signal) {
  if (!config.aiBaseUrl || !config.aiModel) {
    throw new Error('Configurez AI_BASE_URL et AI_MODEL pour le fournisseur hébergé.');
  }
  const headers = { 'content-type': 'application/json' };
  if (config.aiApiKey) headers.authorization = `Bearer ${config.aiApiKey}`;
  const response = await fetch(endpoint(config.aiBaseUrl, 'chat/completions'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: config.aiModel, messages, stream: true }),
    signal
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Le fournisseur IA a répondu ${response.status}: ${detail}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const event of events) {
      const data = event.split('\n').find((line) => line.startsWith('data:'))?.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      const chunk = JSON.parse(data);
      const content = chunk.choices?.[0]?.delta?.content;
      if (typeof content === 'string') yield content;
    }
  }
}

async function* stream(messages, signal) {
  if (config.aiProvider === 'ollama') yield* ollamaStream(messages, signal);
  else if (config.aiProvider === 'openai-compatible') yield* compatibleStream(messages, signal);
  else throw new Error(`AI_PROVIDER non pris en charge: ${config.aiProvider}`);
}

module.exports = { stream };
