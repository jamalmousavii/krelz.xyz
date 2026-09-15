import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Explorer() {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState('transactions');
  const [transactions, setTransactions] = useState([]);
  const [miners, setMiners] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchData(); }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stats/network');
      const data = await res.json();
      if (data.success) {
        if (activeTab === 'transactions') setTransactions(data.recent_tasks || []);
        else if (activeTab === 'miners') setMiners(data.top_miners || []);
      }
    } catch (err) { console.error('Error:', err); }
    setLoading(false);
  };

  const tabs = [
    { id: 'transactions', label: t('explorer.transactions'), icon: '📋' },
    { id: 'miners', label: t('explorer.miners'), icon: '🖥️' },
    { id: 'stats', label: t('explorer.networkStats'), icon: '📊' },
  ];

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head><title>{t('explorer.title')}</title></Head>

      <nav className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-bold text-white">🚀 Krelz Network</a>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a href="/" className="text-white hover:text-gray-300 text-sm">{t('nav.back')}</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-8">
        <h1 className="text-2xl md:text-4xl font-bold text-white text-center mb-6 md:mb-8">🔍 {t('explorer.heading')}</h1>

        <div className="mb-4 md:mb-6">
          <input
            type="text"
            placeholder={t('explorer.search')}
            className="w-full bg-white/10 text-white placeholder-gray-400 px-4 md:px-6 py-3 md:py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm md:text-base"
          />
        </div>

        <div className="flex gap-2 mb-6 md:mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 md:px-6 py-2 md:py-3 rounded-xl transition font-bold whitespace-nowrap text-sm md:text-base ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {loading && <div className="text-center text-gray-400 py-10 md:py-20">{t('explorer.loading')}</div>}

        {!loading && activeTab === 'transactions' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-white text-sm md:text-base">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="px-3 md:px-6 py-3 md:py-4 text-right">{t('explorer.id')}</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-right hidden sm:table-cell">{t('explorer.user')}</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-right hidden sm:table-cell">{t('explorer.minerLabel')}</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-right">{t('explorer.token')}</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-right">{t('explorer.status')}</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-right hidden md:table-cell">{t('explorer.time')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr><td colSpan="6" className="text-center py-8 md:py-10 text-gray-400">{t('explorer.noTransactions')}</td></tr>
                )}
                {transactions.map((tx, i) => (
                  <tr key={i} className="border-b border-white/10 hover:bg-white/5">
                    <td className="px-3 md:px-6 py-3 md:py-4 font-mono text-xs md:text-sm">#{tx.id || i + 1}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 font-mono text-xs md:text-sm hidden sm:table-cell">{tx.user_id || '--'}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 font-mono text-xs md:text-sm hidden sm:table-cell">{tx.miner_id || '--'}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-green-400">{tx.tokens_used || 0} KRELZ</td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        tx.status === 'completed' ? 'bg-green-800 text-green-300' :
                        tx.status === 'processing' ? 'bg-yellow-800 text-yellow-300' :
                        'bg-red-800 text-red-300'
                      }`}>
                        {tx.status === 'completed' ? t('explorer.completed') :
                         tx.status === 'processing' ? t('explorer.processing') :
                         t('explorer.failed')}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm text-gray-400 hidden md:table-cell">
                      {tx.created_at ? new Date(tx.created_at).toLocaleString() : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && activeTab === 'miners' && (
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            {miners.length === 0 && (
              <div className="col-span-2 text-center text-gray-400 py-10 md:py-20">{t('explorer.noMiners')}</div>
            )}
            {miners.map((miner, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-lg rounded-xl p-4 md:p-6">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <span className="text-base md:text-lg font-bold text-white">{t('explorer.minerNum')}{i + 1}</span>
                  <span className={`px-2 md:px-3 py-1 rounded-full text-xs ${
                    miner.status === 'online' ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'
                  }`}>
                    {miner.status === 'online' ? t('explorer.online') : t('explorer.offline')}
                  </span>
                </div>
                <div className="text-gray-300 text-xs md:text-sm space-y-1">
                  <p>GPU: {miner.gpu_model || t('explorer.unknown')}</p>
                  <p>{t('explorer.tasks')}: {miner.total_tasks || 0}</p>
                  <p>{t('explorer.earnings')}: {(miner.earnings || 0).toFixed(2)} KRELZ</p>
                  <p className="font-mono text-xs text-gray-500 mt-2">
                    {miner.wallet_address ? `${miner.wallet_address.slice(0, 10)}...` : '--'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && activeTab === 'stats' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 md:p-8 text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">--</div>
              <div className="text-gray-300 text-sm md:text-base">{t('explorer.activeMiners')}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 md:p-8 text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">--</div>
              <div className="text-gray-300 text-sm md:text-base">{t('explorer.completedTasks')}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 md:p-8 text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">--</div>
              <div className="text-gray-300 text-sm md:text-base">{t('explorer.tokensBurned')}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
