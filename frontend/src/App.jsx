import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';

const API = '/api';
const MarkdownMessage = lazy(() => import('./MarkdownMessage.jsx'));

async function request(path, token, options = {}) {
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Erreur ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

function AuthScreen({ onAuth }) {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  useEffect(() => {
    fetch(`${API}/config`).then((r) => r.json()).then((data) => setRegistrationEnabled(data.registrationEnabled)).catch(() => {});
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const session = await request(`/auth/${register ? 'register' : 'login'}`, null, {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') })
      });
      onAuth(session);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <div className="auth-card">
      <div className="brand-mark">F</div>
      <h1>Bonjour, <span>ami.</span></h1>
      <p className="muted">Connectez-vous pour retrouver vos conversations.</p>
      <form onSubmit={submit} className="auth-form">
        <label>Adresse e-mail<input name="email" type="email" autoComplete="email" placeholder="vous@exemple.fr" required /></label>
        <label>Mot de passe<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 10 : undefined} required /></label>
        {error && <div className="error-box">{error}</div>}
        <button className="primary-button full" disabled={busy}>{busy ? 'Un instant…' : register ? 'Créer mon compte' : 'Se connecter'}</button>
      </form>
      {registrationEnabled && <p className="auth-switch">{register ? 'Déjà inscrit ?' : 'Nouveau ici ?'} <button onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Se connecter' : 'Créer un compte'}</button></p>}
      <p className="auth-foot">Vos conversations restent privées.</p>
    </div>
  </main>;
}

function Message({ message, streaming }) {
  return <article className={`message ${message.role}`}>
    <div className="avatar">{message.role === 'assistant' ? 'F' : 'V'}</div>
    <div className="message-body">
      <div className="message-label">{message.role === 'assistant' ? 'Friend' : 'Vous'}</div>
      <div className="markdown">
        {message.content ? <Suspense fallback={<p>Chargement du rendu…</p>}><MarkdownMessage content={message.content} /></Suspense> : <span className="typing"><i /><i /><i /></span>}
        {streaming && <span className="cursor" />}
      </div>
      {message.attachments?.length > 0 && <div className="attachment-list">{message.attachments.map((file) => <span className="attachment-chip" key={file.id}>▧ {file.name}</span>)}</div>}
    </div>
  </article>;
}

function AdminPanel({ token, onClose }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [plugins, setPlugins] = useState([]);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const [s, u, p] = await Promise.all([
        request('/admin/stats', token), request('/admin/users', token), request('/admin/plugins', token)
      ]);
      setStats(s); setUsers(u); setPlugins(p);
    } catch (e) { setError(e.message); }
  }, [token]);
  useEffect(() => { refresh(); }, [refresh]);

  async function addPlugin(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request('/admin/plugins', token, { method: 'POST', body: JSON.stringify({ name: form.get('name'), description: form.get('description'), prompt: form.get('prompt') }) });
      formElement.reset();
      refresh();
    } catch (e) { setError(e.message); }
  }

  return <section className="admin-panel">
    <div className="admin-header"><div><p className="eyebrow">ESPACE ADMINISTRATEUR</p><h2>Vue d’ensemble</h2></div><button className="icon-button" onClick={onClose} aria-label="Fermer">×</button></div>
    {error && <div className="error-box">{error}</div>}
    <div className="stats-grid">{[['Comptes', stats?.users], ['Conversations', stats?.chats], ['Messages', stats?.messages]].map(([label, count]) => <div className="stat-card" key={label}><span>{label}</span><strong>{count ?? '—'}</strong></div>)}</div>
    <div className="admin-section"><h3>Utilisateurs</h3><div className="table-wrap"><table><thead><tr><th>E-mail</th><th>Rôle</th><th>État</th><th>Action</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.email}</td><td>{user.role}</td><td>{user.disabled ? 'Suspendu' : 'Actif'}</td><td><button className="text-button" onClick={async () => { try { await request(`/admin/users/${user.id}`, token, { method: 'PATCH', body: JSON.stringify({ disabled: !user.disabled }) }); refresh(); } catch (e) { setError(e.message); } }}>{user.disabled ? 'Réactiver' : 'Suspendre'}</button></td></tr>)}</tbody></table></div></div>
    <div className="admin-section"><h3>Extensions de prompt</h3><p className="muted">Ajoutez des instructions réutilisables à l’assistant. Ce sont des prompts, pas du code arbitraire.</p>
      <form className="plugin-form" onSubmit={addPlugin}><input name="name" placeholder="Nom" required /><input name="description" placeholder="Description (facultative)" /><textarea name="prompt" placeholder="Instructions de l’extension" required rows="3" /><button className="primary-button">Ajouter l’extension</button></form>
      <div className="plugin-list">{plugins.map((plugin) => <div className="plugin-row" key={plugin.id}><span><strong>{plugin.name}</strong><small>{plugin.description}</small></span><label className="switch"><input type="checkbox" checked={Boolean(plugin.enabled)} onChange={async (e) => { try { await request(`/admin/plugins/${plugin.id}`, token, { method: 'PATCH', body: JSON.stringify({ enabled: e.target.checked }) }); refresh(); } catch (err) { setError(err.message); } }} /><span /></label><button className="icon-button danger" onClick={async () => { try { await request(`/admin/plugins/${plugin.id}`, token, { method: 'DELETE' }); refresh(); } catch (e) { setError(e.message); } }}>×</button></div>)}</div>
    </div>
  </section>;
}

function MemoryDialog({ token, onClose }) {
  const [memories, setMemories] = useState([]);
  const [error, setError] = useState('');
  const refresh = useCallback(() => request('/memories', token).then(setMemories).catch((e) => setError(e.message)), [token]);
  useEffect(() => { refresh(); }, [refresh]);
  async function add(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try { await request('/memories', token, { method: 'POST', body: JSON.stringify({ content: form.get('content') }) }); formElement.reset(); refresh(); }
    catch (e) { setError(e.message); }
  }
  return <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="dialog">
    <div className="dialog-header"><div><p className="eyebrow">PERSONNALISATION</p><h2>Ma mémoire</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
    <p className="muted">Ajoutez des informations utiles que Friend pourra rappeler dans vos prochaines conversations.</p>
    <form className="memory-form" onSubmit={add}><textarea name="content" maxLength="1000" rows="3" placeholder="Ex. Je préfère des réponses courtes et je travaille dans le design." required /><button className="primary-button">Ajouter</button></form>
    {error && <div className="error-box">{error}</div>}
    <div className="memory-list">{memories.map((item) => <div className="memory-item" key={item.id}><span>{item.content}</span><button className="icon-button danger" aria-label="Supprimer" onClick={async () => { try { await request(`/memories/${item.id}`, token, { method: 'DELETE' }); refresh(); } catch (e) { setError(e.message); } }}>×</button></div>)}
      {!memories.length && <p className="empty-note">Aucun souvenir enregistré.</p>}
    </div>
  </section></div>;
}

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('friend-session') || 'null'); } catch { return null; }
  });
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('friend-theme') !== 'light');
  const [provider, setProvider] = useState('ollama');
  const [listening, setListening] = useState(false);
  const bottomRef = useRef(null);
  const fileInput = useRef(null);
  const abortRef = useRef(null);
  const skipNextChatLoad = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('friend-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => { fetch(`${API}/config`).then((r) => r.json()).then((data) => setProvider(data.provider)).catch(() => {}); }, []);
  const token = session?.token;

  const loadChats = useCallback(async () => {
    if (!token) return;
    try { const data = await request('/chats', token); setChats(data); }
    catch (e) { setError(e.message); }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadChats();
  }, [loadChats, token]);

  useEffect(() => {
    if (!token || !activeId) { setMessages([]); return; }
    if (skipNextChatLoad.current) {
      skipNextChatLoad.current = false;
      return;
    }
    request(`/chats/${activeId}`, token).then((chat) => setMessages(chat.messages)).catch((e) => setError(e.message));
  }, [activeId, token]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    function handleShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        newChat();
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  function auth(value) {
    localStorage.setItem('friend-session', JSON.stringify(value));
    setSession(value);
  }
  function logout() {
    abortRef.current?.abort();
    localStorage.removeItem('friend-session');
    setSession(null); setChats([]); setMessages([]); setActiveId(null);
  }

  async function newChat() {
    setError('');
    try {
      const chat = await request('/chats', token, { method: 'POST', body: JSON.stringify({}) });
      setChats((current) => [chat, ...current]); setActiveId(chat.id); setMessages([]); setAdminOpen(false); setMobileMenuOpen(false);
    } catch (e) { setError(e.message); }
  }

  async function removeChat(event, id) {
    event.stopPropagation();
    try {
      await request(`/chats/${id}`, token, { method: 'DELETE' });
      setChats((current) => current.filter((chat) => chat.id !== id));
      if (activeId === id) { setActiveId(null); setMessages([]); }
    } catch (e) { setError(e.message); }
  }

  async function attachFiles(selected) {
    if (!selected?.length) return;
    const form = new FormData();
    Array.from(selected).slice(0, 5).forEach((file) => form.append('files', file));
    try {
      const added = await request('/uploads', token, { method: 'POST', body: form });
      setFiles((current) => [...current, ...added].slice(0, 5));
      setError('');
    } catch (e) { setError(e.message); }
    if (fileInput.current) fileInput.current.value = '';
  }

  async function send(event) {
    event?.preventDefault();
    if (busy || (!input.trim() && !files.length)) return;
    setError('');
    let chatId = activeId;
    if (!chatId) {
      try {
        const chat = await request('/chats', token, { method: 'POST', body: JSON.stringify({}) });
        chatId = chat.id;
        skipNextChatLoad.current = true;
        setActiveId(chatId);
      } catch (e) { setError(e.message); return; }
    }
    const content = input.trim();
    const attached = [...files];
    setInput(''); setFiles([]); setBusy(true);
    setMessages((current) => [...current, { role: 'user', content, attachments: attached }, { role: 'assistant', content: '', streaming: true }]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch(`${API}/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, attachmentIds: attached.map((file) => file.id) }),
        signal: controller.signal
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const eventText of events) {
          const type = eventText.match(/^event: ([\w-]+)/m)?.[1];
          const data = eventText.match(/^data: (.*)$/m)?.[1];
          if (!data) continue;
          const payload = JSON.parse(data);
          if (type === 'token') setMessages((current) => {
            const copy = [...current]; const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, content: last.content + payload };
            return copy;
          });
          if (type === 'error') streamError = payload.error;
          if (type === 'user-message') setMessages((current) => current.map((message, index) => index === current.length - 2 ? { ...message, created_at: payload.created_at } : message));
        }
      }
      if (streamError) throw new Error(streamError);
      setMessages((current) => current.map((message) => message.streaming ? { ...message, streaming: false } : message));
      await loadChats();
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
      setMessages((current) => current.filter((message) => !message.streaming));
    } finally { setBusy(false); }
  }

  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setError('La reconnaissance vocale n’est pas disponible dans ce navigateur.'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR'; recognition.interimResults = true;
    recognition.onresult = (event) => setInput(Array.from(event.results).map((result) => result[0].transcript).join(''));
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setError('La reconnaissance vocale a échoué.'); };
    setListening(true); recognition.start();
  }

  function speak(text) {
    if (!window.speechSynthesis) { setError('La synthèse vocale n’est pas disponible dans ce navigateur.'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR'; window.speechSynthesis.speak(utterance);
  }

  if (!session?.token) return <AuthScreen onAuth={auth} />;

  return <main className="app-shell">
    <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand"><div className="brand-mark small">F</div><div><strong>Friend</strong><small>Votre espace IA</small></div></div>
      <button className="new-chat" onClick={newChat}><span>＋</span> Nouvelle conversation <kbd>⌘ K</kbd></button>
      <div className="history-title">RÉCENT <span>{chats.length}</span></div>
      <nav className="chat-list">{chats.map((chat) => <button key={chat.id} className={`chat-link ${activeId === chat.id && !adminOpen ? 'selected' : ''}`} onClick={() => { setActiveId(chat.id); setAdminOpen(false); setMobileMenuOpen(false); }}>
        <span className="chat-symbol">◌</span><span className="chat-title">{chat.title}</span><span className="delete-chat" onClick={(e) => removeChat(e, chat.id)} aria-label="Supprimer">×</span>
      </button>)}
        {!chats.length && <p className="sidebar-empty">Vos conversations apparaîtront ici.</p>}
      </nav>
      <div className="sidebar-bottom">
        <button className="side-action" onClick={() => setMemoryOpen(true)}><span>✦</span> Ma mémoire</button>
        {session.user?.role === 'admin' && <button className={`side-action ${adminOpen ? 'selected' : ''}`} onClick={() => setAdminOpen(!adminOpen)}><span>⌘</span> Administration</button>}
        <button className="side-action" onClick={() => window.open('/api-docs', '_blank', 'noopener,noreferrer')}><span>⌁</span> Documentation API</button>
        <div className="account-row"><div className="user-avatar">{session.user?.email?.[0]?.toUpperCase() || 'U'}</div><div className="account-info"><strong>{session.user?.email}</strong><small>{session.user?.role === 'admin' ? 'Administrateur' : 'Compte personnel'}</small></div><button className="icon-button logout" onClick={logout} title="Déconnexion">↗</button></div>
      </div>
    </aside>
    <section className="main-panel">
      <header className="topbar"><div className="mobile-brand"><button className="icon-button mobile-menu-button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Ouvrir les conversations">☰</button><div className="brand-mark small">F</div>Friend</div><div className="provider-indicator"><span className="status-dot" />{provider === 'ollama' ? 'IA locale' : 'IA hébergée'}<span className="separator">·</span><span>{provider === 'ollama' ? 'Ollama' : 'API compatible'}</span></div><div className="top-actions">
        <button className="icon-button" aria-label="Basculer le thème" title="Basculer le thème" onClick={() => setDark(!dark)}>{dark ? '☼' : '☾'}</button>
        {messages.length > 0 && <button className="icon-button print-button" onClick={() => window.print()} title="Exporter en PDF via la fenêtre d’impression">⇩</button>}
      </div></header>
      {mobileMenuOpen && <button className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} aria-label="Fermer les conversations" />}
      {adminOpen ? <AdminPanel token={token} onClose={() => setAdminOpen(false)} /> : <div className="conversation">
        {activeId && messages.length > 0 ? <div className="messages">{messages.map((message, index) => <div className="message-wrap" key={`${message.id || message.role}-${index}`}><Message message={message} streaming={message.streaming} />{message.role === 'assistant' && message.content && !message.streaming && <button className="speak-button" onClick={() => speak(message.content)}>◖ Lire à voix haute</button>}</div>)}<div ref={bottomRef} /></div> :
          <div className="welcome"><div className="welcome-orb">✳</div><h1>En quoi puis-je<br /><span>vous aider ?</span></h1><p className="welcome-caption">Posez une question, partagez un document ou<br className="desktop-only" /> commencez simplement à réfléchir.</p>
            <div className="suggestions">{['Aide-moi à clarifier une idée', 'Résume un document', 'Explique-moi un concept'].map((prompt) => <button key={prompt} onClick={() => { setInput(prompt); document.querySelector('.composer textarea')?.focus(); }}>{prompt}<span>↗</span></button>)}</div>
          </div>}
        {error && <div className="error-toast"><span>{error}</span><button onClick={() => setError('')}>×</button></div>}
        <form className="composer-wrap" onSubmit={send}>
          {files.length > 0 && <div className="pending-files">{files.map((file) => <span className="attachment-chip" key={file.id}>{file.name}<button type="button" onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))}>×</button></span>)}</div>}
          <div className="composer"><button type="button" className="icon-button attach-button" onClick={() => fileInput.current?.click()} title="Joindre PDF ou image">＋</button><input ref={fileInput} type="file" accept=".pdf,image/*" multiple hidden onChange={(e) => attachFiles(e.target.files)} /><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Écrivez votre message…" rows="1" disabled={busy} /><button type="button" className={`icon-button voice-button ${listening ? 'recording' : ''}`} title="Dicter un message" onClick={startVoice}>◉</button><button type="submit" className="send-button" disabled={busy || (!input.trim() && !files.length)} aria-label="Envoyer">{busy ? '…' : '↑'}</button></div>
          <div className="composer-note">Friend peut se tromper. Vérifiez les informations importantes. <span>Maj + Entrée pour aller à la ligne</span></div>
        </form>
      </div>}
    </section>
    {memoryOpen && <MemoryDialog token={token} onClose={() => setMemoryOpen(false)} />}
  </main>;
}
