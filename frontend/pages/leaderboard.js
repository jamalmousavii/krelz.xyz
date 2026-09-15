import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Leaderboard() {
  const { lang } = useLanguage();
  const [tab, setTab] = useState('miners');
  const [miners, setMiners] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => { fetchData(); }, [tab]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/leaderboard/${tab}`);
      const data = await res.json();
      if (data.success) {
        if (tab === 'miners') setMiners(data.miners || []);
        else setUsers(data.users || []);
      }
    } catch (err) { console.error(err); }
  };

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head><title>Leaderboard - Krelz Network</title></Head>
      <nav className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-bold text-white">🚀 Krelz Network</a>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a href="/" className="text-white hover:text-gray-300 text-sm">← Home</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-12 max-w-3xl">
        <h1 className="text-2xl md:text-4xl font-bold text-white text-center mb-6 md:mb-8">🏆 Leaderboard</h1>

        <div className="flex gap-2 mb-6 justify-center">
          {['miners', 'users'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-lg text-sm font-bold ${tab === t ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
              {t === 'miners' ? '🖥️ Top Miners' : '👤 Top Users'}
            </button>
          ))}
        </div>

        {tab === 'miners' && (
          <div className="space-y-3">
            {miners.length === 0 && <p className="text-gray-400 text-center py-10">No miners yet</p>}
            {miners.map((m, i) => (
              <div key={m.id} className={`bg-white/10 backdrop-blur-lg rounded-xl p-4 flex items-center gap-4 ${i < 3 ? 'ring-1 ring-yellow-500/30' : ''}`}>
                <div className="text-2xl w-10 text-center">{medals[i] || `#${i + 1}`}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm truncate">{m.gpu_model || 'Unknown GPU'}</div>
                  <div className="text-gray-400 text-xs font-mono">{m.wallet_address?.slice(0, 12)}...</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-green-400 font-bold">{(m.earnings || 0).toFixed(2)}</div>
                  <div className="text-gray-400 text-xs">{m.total_tasks} tasks</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-3">
            {users.length === 0 && <p className="text-gray-400 text-center py-10">No users yet</p>}
            {users.map((u, i) => (
              <div key={u.id} className={`bg-white/10 backdrop-blur-lg rounded-xl p-4 flex items-center gap-4 ${i < 3 ? 'ring-1 ring-yellow-500/30' : ''}`}>
                <div className="text-2xl w-10 text-center">{medals[i] || `#${i + 1}`}</div>
                <div className="flex-1 min-w-0">
                  {u.avatar ? (
                    <img src={u.avatar} className="w-8 h-8 rounded-full inline-block mr-2" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-purple-600 inline-flex items-center justify-center mr-2 text-sm text-white">{(u.name || '?')[0]}</div>
                  )}
                  <span className="text-white font-bold text-sm">{u.name || 'Anonymous'}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-green-400 font-bold">{(u.earned || 0).toFixed(2)} KRELZ</div>
                  <div className="text-gray-400 text-xs">earned</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
