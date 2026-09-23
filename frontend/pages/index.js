import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import Navbar from '../components/Navbar';

const CATEGORY_ICONS = { chat: '💬', code: '💻', vision: '👁️', embedding: '🔗' };

export default function Home() {
  const { t, lang } = useLanguage();
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('qwen3.6:27b');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [subject, setSubject] = useState('');
  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectInput, setSubjectInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);

  const hasStarted = chat.length > 0;

  useEffect(() => {
    fetchModels();
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      setIsLoggedIn(true);
      fetchSessions(savedToken);
    }
  }, []);

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, loading]);

  const authHeaders = (tkn) => ({
    'Content-Type': 'application/json',
    ...(tkn ? { Authorization: `Bearer ${tkn}` } : {})
  });

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (data.success) setModels(data.models);
    } catch (err) { console.error('Failed to load models'); }
  };

  const fetchSessions = async (tkn) => {
    try {
      const res = await fetch('/api/chat/sessions', { headers: authHeaders(tkn) });
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions);
        if (data.sessions.length > 0 && !activeSessionId) {
          loadSession(data.sessions[0].id, tkn);
        }
      }
    } catch (err) { console.error('Failed to load sessions'); }
  };

  const loadSession = async (sessionId, tkn) => {
    const useToken = tkn || token;
    if (!useToken) return;
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, { headers: authHeaders(useToken) });
      const data = await res.json();
      if (data.success) {
        setActiveSessionId(sessionId);
        setSubject(data.session.subject || 'New Chat');
        const msgs = [];
        data.messages.forEach(m => {
          if (m.content) msgs.push({ role: m.role, content: m.content });
        });
        setChat(msgs);
      }
    } catch (err) { console.error('Failed to load session'); }
  };

  const createNewSession = async () => {
    if (!token) {
      setActiveSessionId(null);
      setSubject('');
      setChat([]);
      return;
    }
    try {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ subject: 'New Chat', model: selectedModel })
      });
      const data = await res.json();
      if (data.success) {
        setSessions(prev => [data.session, ...prev]);
        setActiveSessionId(data.session.id);
        setSubject(data.session.subject);
        setChat([]);
      }
    } catch (err) { console.error('Failed to create session'); }
  };

  const deleteSession = async (sessionId) => {
    if (!token) return;
    try {
      await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: authHeaders(token)
      });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId);
        if (remaining.length > 0) {
          loadSession(remaining[0].id);
        } else {
          setActiveSessionId(null);
          setSubject('');
          setChat([]);
        }
      }
    } catch (err) { console.error('Failed to delete session'); }
  };

  const updateSubject = async () => {
    if (!token || !activeSessionId || !subjectInput.trim()) return;
    try {
      await fetch(`/api/chat/sessions/${activeSessionId}`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({ subject: subjectInput.trim() })
      });
      setSubject(subjectInput.trim());
      setEditingSubject(false);
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId ? { ...s, subject: subjectInput.trim() } : s
      ));
    } catch (err) { console.error('Failed to update subject'); }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    const userMessage = message;
    setMessage('');
    setChat(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          message: userMessage,
          model: selectedModel,
          session_id: activeSessionId
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChat(prev => [...prev, { role: 'assistant', content: data.response, provider_name: data.provider_name || null }]);
        if (data.session_id && !activeSessionId) {
          setActiveSessionId(data.session_id);
          fetchSessions(token);
        } else if (data.session_id && activeSessionId) {
          fetchSessions(token);
        }
      } else {
        setChat(prev => [...prev, { role: 'assistant', content: data.error || t('chat.errorResponse') }]);
      }
    } catch (err) {
      setChat(prev => [...prev, { role: 'assistant', content: t('chat.errorConnection') }]);
    }
    setLoading(false);
  };

  const selectedModelData = models.find(m => m.id === selectedModel);

  const ModelDropdown = ({ upward }) => (
    <div className="relative w-full md:w-auto" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="w-full md:w-auto bg-white hover:bg-sky-50 text-gray-700 border border-sky-200 px-4 py-3 md:py-3.5 rounded-xl transition flex items-center gap-2 min-w-[180px] justify-between text-sm shadow-sm"
      >
        <span className="truncate font-medium">
          {selectedModelData ? `${CATEGORY_ICONS[selectedModelData.category]} ${selectedModelData.name}` : selectedModel}
        </span>
        <span className="text-gray-400 text-xs">▼</span>
      </button>
      {dropdownOpen && (
        <div className={`absolute ${upward ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 w-full md:w-72 bg-white border border-sky-200 rounded-xl shadow-xl overflow-hidden z-50 max-h-[300px] overflow-y-auto`}>
          {models.map((model) => {
            const isSelected = selectedModel === model.id;
            const hasMiners = model.miners_online > 0;
            return (
              <button
                key={model.id}
                onClick={() => { if (hasMiners) { setSelectedModel(model.id); setDropdownOpen(false); } }}
                disabled={!hasMiners}
                className={`w-full text-left px-4 py-3 flex items-center justify-between transition text-sm border-b border-sky-50 last:border-0 ${
                  isSelected ? 'bg-sky-100 text-sky-800' : hasMiners ? 'hover:bg-sky-50 text-gray-700' : 'opacity-40 cursor-not-allowed text-gray-400'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span>{CATEGORY_ICONS[model.category]}</span>
                  <span className="truncate font-medium">{model.name}</span>
                  <span className="text-sky-600 text-xs">{model.size}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {hasMiners ? (
                    <span className="text-emerald-600 text-xs">✅ {model.miners_online}</span>
                  ) : (
                    <span className="text-red-400 text-xs">⚠️ 0</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // ===== EMPTY STATE: centered hero =====
  if (!hasStarted) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex flex-col ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
        <Head>
          <title>Krelz Network - Decentralized LLM Inference</title>
          <meta name="description" content="Decentralized LLM Inference Network. Chat with AI models." />
        </Head>

        <Navbar />

        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
          <div className="text-center mb-8 md:mb-10">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-3">🚀 Krelz Network</h1>
            <p className="text-lg md:text-xl text-gray-500">{t('home.subtitle')}</p>
          </div>

          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-sky-100 p-4 md:p-5">
            <div className="flex flex-col md:flex-row gap-3">
              <ModelDropdown upward={false} />
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={t('chat.placeholder')}
                className="flex-1 bg-sky-50 text-gray-800 placeholder-gray-400 border border-sky-100 px-4 md:px-6 py-3 md:py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm md:text-base"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading}
                className="bg-sky-500 hover:bg-sky-600 text-white px-6 md:px-8 py-3 md:py-3.5 rounded-xl transition disabled:opacity-50 font-bold text-sm md:text-base shadow-sm"
              >
                {loading ? '...' : t('chat.send')}
              </button>
            </div>
          </div>

          <p className="text-gray-400 text-sm mt-6">{t('chat.startTyping')}</p>
        </main>

        <footer className="container mx-auto px-6 py-5 text-center text-gray-400 text-xs">
          <p>&copy; 2026 Krelz Network. {t('home.footer')} {t('home.version')}</p>
        </footer>
      </div>
    );
  }

  // ===== ACTIVE STATE: sidebar + messages + bottom input =====
  return (
    <div className={`min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex flex-col ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head><title>{t('chat.title')}</title></Head>

      <Navbar />

      <main className="flex-1 container mx-auto px-2 md:px-6 pb-4 md:pb-6 max-w-6xl flex gap-0 md:gap-4 min-h-0" style={{ height: 'calc(100vh - 80px)' }}>
        {/* Sidebar — history */}
        {isLoggedIn && (
          <div className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex w-full md:w-64 flex-shrink-0 mb-2 md:mb-0 flex-col`}>
            <div className="bg-white rounded-xl border border-sky-100 shadow-sm p-3 h-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-700 font-bold text-sm">💬 {t('chat.history')}</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="md:hidden text-gray-400 hover:text-gray-600 text-lg"
                >✕</button>
              </div>
              <button
                onClick={createNewSession}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white px-4 py-2.5 rounded-lg transition font-medium text-sm mb-3"
              >
                + {t('chat.newChat')}
              </button>

              <div className="flex-1 overflow-y-auto space-y-1">
                {sessions.length === 0 ? (
                  <p className="text-gray-400 text-xs text-center py-4">{t('chat.noSessions')}</p>
                ) : (
                  sessions.map(session => (
                    <div
                      key={session.id}
                      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition text-sm ${
                        activeSessionId === session.id
                          ? 'bg-sky-100 text-sky-800 font-medium'
                          : 'text-gray-600 hover:bg-sky-50'
                      }`}
                      onClick={() => loadSession(session.id)}
                    >
                      <span className="flex-1 truncate">{session.subject || t('chat.untitled')}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                        className="hidden group-hover:block text-red-400 hover:text-red-500 text-xs flex-shrink-0"
                        title={t('chat.deleteSession')}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Subject bar */}
          {isLoggedIn && activeSessionId && (
            <div className="bg-white border border-sky-100 rounded-t-xl px-4 py-2.5 flex items-center gap-2 mb-0 shadow-sm">
              {isLoggedIn && !sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-400 hover:text-sky-600 mr-1">☰</button>
              )}
              {editingSubject ? (
                <input
                  type="text"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') updateSubject(); if (e.key === 'Escape') setEditingSubject(false); }}
                  onBlur={updateSubject}
                  autoFocus
                  className="flex-1 bg-sky-50 text-gray-800 border border-sky-200 px-3 py-1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                  placeholder={t('chat.subjectPlaceholder')}
                />
              ) : (
                <>
                  <span className="text-gray-700 text-sm font-medium truncate">{subject || t('chat.untitled')}</span>
                  <button
                    onClick={() => { setSubjectInput(subject); setEditingSubject(true); }}
                    className="text-gray-400 hover:text-sky-600 text-xs transition"
                    title={t('chat.renameSession')}
                  >
                    ✏️
                  </button>
                </>
              )}
            </div>
          )}

          {/* Messages */}
          <div className={`bg-white border border-sky-100 ${isLoggedIn && activeSessionId ? 'rounded-b-xl' : 'rounded-xl'} p-3 md:p-5 flex-1 overflow-y-auto mb-3 shadow-sm`}>
            {chat.map((msg, i) => (
              <div key={i} className={`mb-4 ${msg.role === 'user' ? (lang === 'fa' ? 'text-right' : 'text-left') : (lang === 'fa' ? 'text-left' : 'text-right')}`}>
                <div className={`inline-block max-w-[85%] md:max-w-[80%] p-3 md:p-4 rounded-2xl text-sm md:text-base ${
                  msg.role === 'user'
                    ? 'bg-sky-500 text-white'
                    : 'bg-sky-50 text-gray-800 border border-sky-100'
                }`}>
                  {msg.content}
                </div>
                {msg.role === 'assistant' && msg.provider_name && (
                  <div className={`text-xs text-gray-400 mt-1 ${lang === 'fa' ? 'text-right' : 'text-left'}`}>
                    ⚡ via {msg.provider_name}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className={lang === 'fa' ? 'text-left' : 'text-right'}>
                <div className="inline-block bg-sky-50 text-gray-600 border border-sky-100 p-3 md:p-4 rounded-2xl text-sm md:text-base">{t('chat.typing')}</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar — pinned bottom */}
          <div className="flex flex-col md:flex-row gap-2 md:gap-3">
            <ModelDropdown upward={true} />
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={t('chat.placeholder')}
              className="flex-1 bg-white text-gray-800 placeholder-gray-400 border border-sky-200 px-4 md:px-6 py-3 md:py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm md:text-base shadow-sm"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="bg-sky-500 hover:bg-sky-600 text-white px-6 md:px-8 py-3 md:py-3.5 rounded-xl transition disabled:opacity-50 font-bold text-sm md:text-base shadow-sm"
            >
              {loading ? '...' : t('chat.send')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
