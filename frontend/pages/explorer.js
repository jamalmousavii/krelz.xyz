import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import Navbar from '../components/Navbar';

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
    <div className={`min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head><title>{t('explorer.title')}</title></Head>

      <Navbar />

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-8">
        <h1 className="text-2xl md:text-4xl font-bold text-gray-800 text-center mb-6 md:mb-8">🔍 {t('explorer.heading')}</h1>

        <div className="mb-4 md:mb-6">
          <input
            type="text"
            placeholder={t('explorer.search')}
            className="w-full bg-white text-gray-800 placeholder-gray-400 border border-sky-200 px-4 md:px-6 py-3 md:py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm md:text-base shadow-sm"
          />
        </div>

        <div className="flex gap-2 mb-6 md:mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 md:px-6 py-2 md:py-3 rounded-xl transition font-bold whitespace-nowrap text-sm md:text-base ${
                activeTab === tab.id
                  ? 'bg-sky-500 text-white'
                  : 'bg-white text-gray-600 border border-sky-200 hover:bg-sky-50'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {loading && <div className="text-center text-gray-500 py-10 md:py-20">{t('explorer.loading')}</div>}

        {!loading && activeTab === 'transactions' && (
          <div className="bg-white border border-sky-100 shadow-sm rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-gray-700 text-sm md:text-base">
              <thead>
                <tr className="border-b border-sky-100 bg-sky-50">
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
                  <tr key={i} className="border-b border-sky-50 hover:bg-sky-50/50">
                    <td className="px-3 md:px-6 py-3 md:py-4 font-mono text-xs md:text-sm">#{tx.id || i + 1}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 font-mono text-xs md:text-sm hidden sm:table-cell">{tx.user_id || '--'}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 font-mono text-xs md:text-sm hidden sm:table-cell">{tx.miner_id || '--'}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-emerald-600">{tx.tokens_used || 0} KRELZ</td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        tx.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-600'
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
              <div key={i} className="bg-white border border-sky-100 shadow-sm rounded-xl p-4 md:p-6">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <span className="text-base md:text-lg font-bold text-gray-800">{t('explorer.minerNum')}{i + 1}</span>
                  <span className={`px-2 md:px-3 py-1 rounded-full text-xs ${
                    miner.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {miner.status === 'online' ? t('explorer.online') : t('explorer.offline')}
                  </span>
                </div>
                <div className="text-gray-600 text-xs md:text-sm space-y-1">
                  <p>GPU: {miner.gpu_model || t('explorer.unknown')}</p>
                  <p>{t('explorer.tasks')}: {miner.total_tasks || 0}</p>
                  <p>{t('explorer.earnings')}: {(miner.earnings || 0).toFixed(2)} KRELZ</p>
                  <p className="font-mono text-xs text-gray-400 mt-2">
                    {miner.wallet_address ? `${miner.wallet_address.slice(0, 10)}...` : '--'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && activeTab === 'stats' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white border border-sky-100 shadow-sm rounded-xl p-6 md:p-8 text-center">
              <div className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">--</div>
              <div className="text-gray-500 text-sm md:text-base">{t('explorer.activeMiners')}</div>
            </div>
            <div className="bg-white border border-sky-100 shadow-sm rounded-xl p-6 md:p-8 text-center">
              <div className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">--</div>
              <div className="text-gray-500 text-sm md:text-base">{t('explorer.completedTasks')}</div>
            </div>
            <div className="bg-white border border-sky-100 shadow-sm rounded-xl p-6 md:p-8 text-center">
              <div className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">--</div>
              <div className="text-gray-500 text-sm md:text-base">{t('explorer.tokensBurned')}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
