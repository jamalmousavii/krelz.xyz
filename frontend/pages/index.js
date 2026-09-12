import Head from 'next/head';
import { useState, useEffect } from 'react';

export default function Home() {
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
      if (data.success) {
        setStats(data.stats);
      }
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
      alert('لطفاً MetaMask را نصب کنید');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Head>
        <title>Krelz Network</title>
        <meta name="description" content="شبکه غیرمتمرکز LLM" />
      </Head>

      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-white">
            🚀 Krelz Network
          </div>
          <div className="flex items-center gap-4">
            <a href="/explorer" className="text-gray-300 hover:text-white transition">اکسپلورر</a>
            <a href="/miner" className="text-gray-300 hover:text-white transition">ماینر</a>
            <a href="/chat" className="text-gray-300 hover:text-white transition">چت</a>
            <button
              onClick={connectWallet}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition"
            >
              {connected ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : 'اتصال کیف پول'}
            </button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            شبکه LLM غیرمتمرکز
          </h1>
          <p className="text-xl text-gray-300">
            GPU خود را به اشتراک بگذارید، درآمد کسب کنید
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-white">{stats.active_miners}</div>
              <div className="text-gray-300">ماینر فعال</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-white">{stats.total_users}</div>
              <div className="text-gray-300">کاربر</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-white">{stats.total_requests}</div>
              <div className="text-gray-300">درخواست</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-white">{stats.total_tokens_burned}</div>
              <div className="text-gray-300">توکن سوزانده شده</div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">🖥️ ماینر شوید</h2>
            <p className="text-gray-300 mb-6">
              GPU خود را به اشتراک بگذارید و از اجرای مدل‌های هوش مصنوعی درآمد کسب کنید.
            </p>
            <a
              href="/miner"
              className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition"
            >
              شروع ماینینگ
            </a>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">💬 چت با AI</h2>
            <p className="text-gray-300 mb-6">
              با مدل‌های هوش مصنوعی قدرتمند چت کنید و از خدمات LLM استفاده کنید.
            </p>
            <a
              href="/chat"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition"
            >
              شروع چت
            </a>
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-6 py-8 text-center text-gray-400">
        <p>© 2024 Krelz Network. All rights reserved.</p>
      </footer>
    </div>
  );
}
