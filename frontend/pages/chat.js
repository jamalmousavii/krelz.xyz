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
        body: JSON.stringify({ message: userMessage, model: selectedModel, coin: payCoin }),
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

      <nav className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-bold text-white">🚀 Krelz Network</a>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a href="/" className="text-white hover:text-gray-300 text-sm md:text-base">{t('nav.back')}</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 md:px-6 py-4 md:py-8 max-w-3xl">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 md:p-6 h-[350px] md:h-[500px] overflow-y-auto mb-4">
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
      </main>
    </div>
  );
}
