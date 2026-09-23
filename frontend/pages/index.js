import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import Navbar from '../components/Navbar';

export default function Home() {
  const { t, lang } = useLanguage();
  const [stats, setStats] = useState(null);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats/network');
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (err) { console.error('Error fetching stats:', err); }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head>
        <title>Krelz Network - Decentralized LLM Inference</title>
        <meta name="description" content="Decentralized LLM Inference Network. Earn KRELZ tokens by sharing your GPU power." />
      </Head>

      <Navbar />

      <main className="container mx-auto px-6 py-8 md:py-12">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">{t('home.title')}</h1>
          <p className="text-lg md:text-xl text-gray-300">{t('home.subtitle')}</p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8 md:mb-12">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 md:p-6 text-center">
              <div className="text-2xl md:text-3xl font-bold text-white">{stats.active_miners}</div>
              <div className="text-gray-300 text-sm md:text-base">{t('home.activeMiners')}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 md:p-6 text-center">
              <div className="text-2xl md:text-3xl font-bold text-white">{stats.total_users}</div>
              <div className="text-gray-300 text-sm md:text-base">{t('home.users')}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 md:p-6 text-center">
              <div className="text-2xl md:text-3xl font-bold text-white">{stats.total_requests}</div>
              <div className="text-gray-300 text-sm md:text-base">{t('home.requests')}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 md:p-6 text-center">
              <div className="text-2xl md:text-3xl font-bold text-white">{stats.total_tokens_burned}</div>
              <div className="text-gray-300 text-sm md:text-base">{t('home.tokensBurned')}</div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-4">🖥️ {t('home.becomeMiner')}</h2>
            <p className="text-gray-300 mb-6 text-sm md:text-base">{t('home.becomeMinerDesc')}</p>
            <a href="/miner" className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition">
              {t('home.startMining')}
            </a>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-4">💬 {t('home.chatWithAI')}</h2>
            <p className="text-gray-300 mb-6 text-sm md:text-base">{t('home.chatWithAIDesc')}</p>
            <a href="/chat" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition">
              {t('home.startChat')}
            </a>
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-6 py-6 md:py-8 text-center text-gray-400 text-sm">
        <p>&copy; 2026 Krelz Network. {t('home.footer')} v3.14.0</p>
      </footer>
    </div>
  );
}
