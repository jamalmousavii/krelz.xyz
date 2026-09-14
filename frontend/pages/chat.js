import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const CATEGORY_ICONS = { chat: '💬', code: '💻', vision: '👁️', embedding: '🔗' };

export default function Chat() {
  const { t, lang } = useLanguage();
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('qwen3.6:27b');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => { fetchModels(); }, []);
  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (data.success) setModels(data.models);
    } catch (err) { console.error('Failed to load models'); }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    const userMessage = message;
    setMessage('');
    setChat([...chat, { role: 'user', content: userMessage }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, model: selectedModel }),
      });
      const data = await res.json();
      if (data.success) {
        setChat((prev) => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setChat((prev) => [...prev, { role: 'assistant', content: t('chat.errorResponse') }]);
      }
    } catch (err) {
      setChat((prev) => [...prev, { role: 'assistant', content: t('chat.errorConnection') }]);
    }
    setLoading(false);
  };

  const selectedModelData = models.find(m => m.id === selectedModel);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head><title>{t('chat.title')}</title></Head>

      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-white">🚀 Krelz Network</a>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <a href="/" className="text-white hover:text-gray-300">{t('nav.back')}</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-8 max-w-3xl">
        {/* Chat Area */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 h-[500px] overflow-y-auto mb-4">
          {chat.length === 0 && (
            <div className="text-center text-gray-400 py-20">
              <p className="text-xl">{t('chat.greeting')}</p>
            </div>
          )}
          {chat.map((msg, i) => (
            <div key={i} className={`mb-4 ${msg.role === 'user' ? (lang === 'fa' ? 'text-right' : 'text-left') : (lang === 'fa' ? 'text-left' : 'text-right')}`}>
              <div className={`inline-block max-w-[80%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className={lang === 'fa' ? 'text-left' : 'text-right'}>
              <div className="inline-block bg-gray-600 text-white p-4 rounded-2xl">{t('chat.typing')}</div>
            </div>
          )}
        </div>

        {/* Input Row: Dropdown + Input + Send */}
        <div className="flex gap-3">
          {/* Model Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="h-full bg-white/10 hover:bg-white/20 text-white px-4 py-4 rounded-xl transition flex items-center gap-2 min-w-[180px] justify-between"
            >
              <span className="truncate text-sm font-medium">
                {selectedModelData ? `${CATEGORY_ICONS[selectedModelData.category]} ${selectedModelData.name}` : selectedModel}
              </span>
              <span className="text-gray-400 text-xs">▼</span>
            </button>

            {dropdownOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-72 bg-gray-800 border border-gray-600 rounded-xl shadow-xl overflow-hidden z-50">
                {models.map((model) => {
                  const isSelected = selectedModel === model.id;
                  const hasMiners = model.miners_online > 0;
                  return (
                    <button
                      key={model.id}
                      onClick={() => { if (hasMiners) { setSelectedModel(model.id); setDropdownOpen(false); } }}
                      disabled={!hasMiners}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between transition ${
                        isSelected ? 'bg-purple-600/50' : hasMiners ? 'hover:bg-white/10' : 'opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{CATEGORY_ICONS[model.category]}</span>
                        <span className="text-white text-sm truncate">{model.name}</span>
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

          {/* Chat Input */}
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={t('chat.placeholder')}
            className="flex-1 bg-white/10 text-white placeholder-gray-400 px-6 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={loading}
          />

          {/* Send Button */}
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl transition disabled:opacity-50 font-bold"
          >
            {t('chat.send')}
          </button>
        </div>
      </main>
    </div>
  );
}
