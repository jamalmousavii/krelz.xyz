import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const CATEGORY_ICONS = { chat: '💬', code: '💻', vision: '👁️', embedding: '🔗' };
const PAY_COINS = [
  { id: 'USDT', icon: '₮', color: 'text-green-400' },
  { id: 'BNB', icon: '◆', color: 'text-yellow-400' },
  { id: 'BTC', icon: '₿', color: 'text-orange-400' },
  { id: 'ETH', icon: 'Ξ', color: 'text-blue-400' },
  { id: 'TRX', icon: '◎', color: 'text-red-400' },
  { id: 'DOGE', icon: 'Ð', color: 'text-yellow-300' },
  { id: 'XRP', icon: '✕', color: 'text-gray-300' },
];

export default function Chat() {
  const { t, lang } = useLanguage();
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('qwen3.6:27b');
  const [payCoin, setPayCoin] = useState('USDT');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Session state
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [subject, setSubject] = useState('');
  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectInput, setSubjectInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);

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
        // Convert messages to chat format
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
      // No session support without login
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
          coin: payCoin,
          session_id: activeSessionId
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChat(prev => [...prev, { role: 'assistant', content: data.response }]);
        // Update session_id if new session was created
        if (data.session_id && !activeSessionId) {
          setActiveSessionId(data.session_id);
          // Refresh sessions list
          fetchSessions(token);
        } else if (data.session_id && activeSessionId) {
          // Refresh sessions to update message count and order
          fetchSessions(token);
        }
      } else {
        setChat(prev => [...prev, { role: 'assistant', content: t('chat.errorResponse') }]);
      }
    } catch (err) {
      setChat(prev => [...prev, { role: 'assistant', content: t('chat.errorConnection') }]);
    }
    setLoading(false);
  };

  const selectedModelData = models.find(m => m.id === selectedModel);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head><title>{t('chat.title')}</title></Head>

      <nav className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isLoggedIn && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-white hover:text-gray-300 text-xl md:hidden"
              >
                {sidebarOpen ? '✕' : '☰'}
              </button>
            )}
            <a href="/" className="text-xl md:text-2xl font-bold text-white">🚀 Krelz Network</a>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a href="/" className="text-white hover:text-gray-300 text-sm md:text-base">{t('nav.back')}</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-2 md:px-6 pb-4 md:pb-8 max-w-5xl">
        <div className="flex gap-0 md:gap-4 h-[calc(100vh-140px)]">

          {/* Sidebar */}
          {isLoggedIn && (
            <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-64 flex-shrink-0 mb-2 md:mb-0`}>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 h-full flex flex-col">
                <button
                  onClick={createNewSession}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg transition font-medium text-sm mb-3"
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
                            ? 'bg-purple-600/50 text-white'
                            : 'text-gray-300 hover:bg-white/10'
                        }`}
                        onClick={() => loadSession(session.id)}
                      >
                        <span className="flex-1 truncate">{session.subject || t('chat.untitled')}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                          className="hidden group-hover:block text-red-400 hover:text-red-300 text-xs flex-shrink-0"
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

          {/* Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Subject Bar */}
            {isLoggedIn && activeSessionId && (
              <div className="bg-white/10 backdrop-blur-lg rounded-t-xl px-4 py-2.5 flex items-center gap-2 mb-0">
                {editingSubject ? (
                  <input
                    type="text"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') updateSubject(); if (e.key === 'Escape') setEditingSubject(false); }}
                    onBlur={updateSubject}
                    autoFocus
                    className="flex-1 bg-white/10 text-white px-3 py-1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder={t('chat.subjectPlaceholder')}
                  />
                ) : (
                  <>
                    <span className="text-white text-sm font-medium truncate">{subject || t('chat.untitled')}</span>
                    <button
                      onClick={() => { setSubjectInput(subject); setEditingSubject(true); }}
                      className="text-gray-400 hover:text-white text-xs transition"
                      title={t('chat.renameSession')}
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Messages */}
            <div className={`bg-white/10 backdrop-blur-lg ${isLoggedIn && activeSessionId ? 'rounded-b-xl' : 'rounded-xl'} p-3 md:p-6 flex-1 overflow-y-auto mb-4`}>
              {chat.length === 0 && (
                <div className="text-center text-gray-400 py-10 md:py-20">
                  <p className="text-lg md:text-xl">{t('chat.greeting')}</p>
                </div>
              )}
              {chat.map((msg, i) => (
                <div key={i} className={`mb-4 ${msg.role === 'user' ? (lang === 'fa' ? 'text-right' : 'text-left') : (lang === 'fa' ? 'text-left' : 'text-right')}`}>
                  <div className={`inline-block max-w-[85%] md:max-w-[80%] p-3 md:p-4 rounded-2xl text-sm md:text-base ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className={lang === 'fa' ? 'text-left' : 'text-right'}>
                  <div className="inline-block bg-gray-600 text-white p-3 md:p-4 rounded-2xl text-sm md:text-base">{t('chat.typing')}</div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="flex flex-col md:flex-row gap-2 md:gap-3">
              <div className="relative w-full md:w-auto" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full md:w-auto bg-white/10 hover:bg-white/20 text-white px-4 py-3 md:py-4 rounded-xl transition flex items-center gap-2 min-w-[180px] justify-between text-sm"
                >
                  <span className="truncate font-medium">
                    {selectedModelData ? `${CATEGORY_ICONS[selectedModelData.category]} ${selectedModelData.name}` : selectedModel}
                  </span>
                  <span className="text-gray-400 text-xs">▼</span>
                </button>
                {dropdownOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-full md:w-72 bg-gray-800 border border-gray-600 rounded-xl shadow-xl overflow-hidden z-50 max-h-[300px] overflow-y-auto">
                    {models.map((model) => {
                      const isSelected = selectedModel === model.id;
                      const hasMiners = model.miners_online > 0;
                      return (
                        <button
                          key={model.id}
                          onClick={() => { if (hasMiners) { setSelectedModel(model.id); setDropdownOpen(false); } }}
                          disabled={!hasMiners}
                          className={`w-full text-left px-4 py-3 flex items-center justify-between transition text-sm ${
                            isSelected ? 'bg-purple-600/50' : hasMiners ? 'hover:bg-white/10' : 'opacity-40 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span>{CATEGORY_ICONS[model.category]}</span>
                            <span className="text-white truncate">{model.name}</span>
                            <span className="text-purple-300 text-xs">{model.size}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {hasMiners ? (
                              <span className="text-green-400 text-xs">✅ {model.miners_online}</span>
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

              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={t('chat.placeholder')}
                className="flex-1 bg-white/10 text-white placeholder-gray-400 px-4 md:px-6 py-3 md:py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm md:text-base"
                disabled={loading}
              />

              {/* Coin Selector */}
              <div className="flex gap-1 bg-white/10 rounded-xl p-1">
                {PAY_COINS.slice(0, 4).map(c => (
                  <button
                    key={c.id}
                    onClick={() => setPayCoin(c.id)}
                    className={`px-2 py-2 rounded-lg text-xs font-bold transition ${
                      payCoin === c.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                    title={`Pay with ${c.id}`}
                  >
                    {c.icon}
                  </button>
                ))}
              </div>

              <button
                onClick={sendMessage}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl transition disabled:opacity-50 font-bold text-sm md:text-base"
              >
                {t('chat.send')}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
