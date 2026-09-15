import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import GoogleLogin from '../components/GoogleLogin';

export default function Home() {
  const { t, lang } = useLanguage();
  const [wallet, setWallet] = useState(null);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats/network');
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        setWallet(accounts[0]);
        setConnected(true);
      } catch (err) {
        console.error('Error connecting wallet:', err);
      }
    } else {
      alert(t('home.installMetaMask'));
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head>
        <title>Krelz Network</title>
        <meta name="description" content="Decentralized LLM Network" />
      </Head>

      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-white">🚀 Krelz Network</div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <a href="/explorer" className="text-gray-300 hover:text-white transition hidden sm:inline">{t('nav.explorer')}</a>
            <a href="/miner" className="text-gray-300 hover:text-white transition hidden sm:inline">{t('nav.miner')}</a>
            <a href="/chat" className="text-gray-300 hover:text-white transition hidden sm:inline">{t('nav.chat')}</a>
            <button
              onClick={connectWallet}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition text-sm"
            >
              {connected ? `🟢 ${wallet.slice(0, 6)}...${wallet.slice(-4)}` : t('nav.connectWallet')}
            </button>
            <GoogleLogin />
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">{t('home.title')}</h1>
          <p className="text-xl text-gray-300">{t('home.subtitle')}</p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-white">{stats.active_miners}</div>
              <div className="text-gray-300">{t('home.activeMiners')}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-white">{stats.total_users}</div>
              <div className="text-gray-300">{t('home.users')}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-white">{stats.total_requests}</div>
              <div className="text-gray-300">{t('home.requests')}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-white">{stats.total_tokens_burned}</div>
              <div className="text-gray-300">{t('home.tokensBurned')}</div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">🖥️ {t('home.becomeMiner')}</h2>
            <p className="text-gray-300 mb-6">{t('home.becomeMinerDesc')}</p>
            <a href="/miner" className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition">
              {t('home.startMining')}
            </a>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">💬 {t('home.chatWithAI')}</h2>
            <p className="text-gray-300 mb-6">{t('home.chatWithAIDesc')}</p>
            <a href="/chat" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition">
              {t('home.startChat')}
            </a>
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-6 py-8 text-center text-gray-400">
        <p>&copy; 2026 Krelz Network. {t('home.footer')} v1.4.0</p>
      </footer>
    </div>
  );
}
