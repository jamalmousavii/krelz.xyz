import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const CATEGORY_ICONS = {
  chat: '💬',
  code: '💻',
  vision: '👁️',
  embedding: '🔗',
};

const CATEGORY_LABELS = {
  chat: { en: 'Chat & General', fa: 'چت و عمومی' },
  code: { en: 'Code', fa: 'برنامه‌نویسی' },
  vision: { en: 'Vision', fa: 'بینایی' },
  embedding: { en: 'Embedding', fa: 'امبدینگ' },
};

export default function Chat() {
  const { t, lang } = useLanguage();
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (data.success) setModels(data.models);
    } catch (err) {
      console.error('Failed to load models');
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedModel) return;

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

  const categories = [...new Set(models.map(m => m.category))];
  const selectedModelData = models.find(m => m.id === selectedModel);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head>
        <title>{t('chat.title')}</title>
      </Head>

      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-white">🚀 Krelz Network</a>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <a href="/" className="text-white hover:text-gray-300">{t('nav.back')}</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold text-white mb-6">🤖 {t('chat.selectModel')}</h1>

        {/* Model Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {models.map((model) => {
            const isSelected = selectedModel === model.id;
            const hasMiners = model.miners_online > 0;

            return (
              <button
                key={model.id}
                onClick={() => hasMiners && setSelectedModel(model.id)}
                disabled={!hasMiners}
                className={`text-left p-5 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'bg-purple-600/50 border-purple-400 ring-2 ring-purple-400'
                    : hasMiners
                      ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer'
                      : 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{CATEGORY_ICONS[model.category]}</span>
                  <span className="text-white font-bold">{model.name}</span>
                  <span className="text-purple-300 text-sm">{model.size}</span>
                </div>
                <p className="text-gray-400 text-xs mb-3">{model.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">RAM: {model.ram}</span>
                  {hasMiners ? (
                    <span className="text-green-400 text-xs font-medium">
                      ✅ {model.miners_online} {t('chat.minersOnline')}
                    </span>
                  ) : (
                    <span className="text-red-400 text-xs font-medium">
                      ⚠️ {t('chat.noMiners')}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Model Info */}
        {selectedModelData && (
          <div className="bg-purple-600/20 border border-purple-400/30 rounded-xl p-4 mb-4 flex items-center justify-between">
            <div>
              <span className="text-white font-bold">{selectedModelData.name} {selectedModelData.size}</span>
              <span className="text-gray-400 text-sm ml-3">{selectedModelData.desc}</span>
            </div>
            <span className="text-green-400 text-sm">✅ {selectedModelData.miners_online} miners ready</span>
          </div>
        )}

        {/* Chat Area */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 h-[400px] overflow-y-auto mb-4">
          {chat.length === 0 && (
            <div className="text-center text-gray-400 py-20">
              <p className="text-xl">{selectedModel ? t('chat.greeting') : t('chat.selectModelFirst')}</p>
            </div>
          )}
          {chat.map((msg, i) => (
            <div key={i} className={`mb-4 ${msg.role === 'user' ? (lang === 'fa' ? 'text-right' : 'text-left') : (lang === 'fa' ? 'text-left' : 'text-right')}`}>
              <div className={`inline-block max-w-[80%] p-4 rounded-2xl ${
                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
              }`}>
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

        <div className="flex gap-4">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={selectedModel ? t('chat.placeholder') : t('chat.selectModelFirst')}
            className="flex-1 bg-white/10 text-white placeholder-gray-400 px-6 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={loading || !selectedModel}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !selectedModel}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl transition disabled:opacity-50"
          >
            {t('chat.send')}
          </button>
        </div>
      </main>
    </div>
  );
}
