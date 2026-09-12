import Head from 'next/head';
import { useState, useEffect } from 'react';

export default function Explorer() {
  const [activeTab, setActiveTab] = useState('transactions');
  const [transactions, setTransactions] = useState([]);
  const [miners, setMiners] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'transactions') {
        const res = await fetch('/api/stats/network');
        const data = await res.json();
        if (data.success) setTransactions(data.recent_tasks || []);
      } else if (activeTab === 'miners') {
        const res = await fetch('/api/stats/network');
        const data = await res.json();
        if (data.success) setMiners(data.top_miners || []);
      }
    } catch (err) {
      console.error('Error:', err);
    }
    setLoading(false);
  };

  const tabs = [
    { id: 'transactions', label: 'تراکنش‌ها', icon: '📋' },
    { id: 'miners', label: 'ماینرها', icon: '🖥️' },
    { id: 'stats', label: 'آمار شبکه', icon: '📊' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Head>
        <title>اکسپلورر - Krelz Network</title>
      </Head>

      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-white">🚀 Krelz Network</a>
          <a href="/" className="text-white hover:text-gray-300">بازگشت</a>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-white text-center mb-8">🔍 اکسپلورر شبکه</h1>

        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی آدرس تراکنش یا آدرس کیف پول..."
            className="w-full bg-white/10 text-white placeholder-gray-400 px-6 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex gap-2 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-xl transition font-bold ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center text-gray-400 py-20">در حال بارگذاری...</div>
        )}

        {!loading && activeTab === 'transactions' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl overflow-hidden">
            <table className="w-full text-white">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="px-6 py-4 text-right">شناسه</th>
                  <th className="px-6 py-4 text-right">کاربر</th>
                  <th className="px-6 py-4 text-right">ماینر</th>
                  <th className="px-6 py-4 text-right">توکن</th>
                  <th className="px-6 py-4 text-right">وضعیت</th>
                  <th className="px-6 py-4 text-right">زمان</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr><td colSpan="6" className="text-center py-10 text-gray-400">تراکنشی یافت نشد</td></tr>
                )}
                {transactions.map((tx, i) => (
                  <tr key={i} className="border-b border-white/10 hover:bg-white/5">
                    <td className="px-6 py-4 font-mono text-sm">#{tx.id || i + 1}</td>
                    <td className="px-6 py-4 font-mono text-sm">{tx.user_id || '--'}</td>
                    <td className="px-6 py-4 font-mono text-sm">{tx.miner_id || '--'}</td>
                    <td className="px-6 py-4 text-green-400">{tx.tokens_used || 0} KRELZ</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        tx.status === 'completed' ? 'bg-green-800 text-green-300' :
                        tx.status === 'processing' ? 'bg-yellow-800 text-yellow-300' :
                        'bg-red-800 text-red-300'
                      }`}>
                        {tx.status === 'completed' ? 'تکمیل' : tx.status === 'processing' ? 'در حال پردازش' : 'ناموفق'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {tx.created_at ? new Date(tx.created_at).toLocaleString('fa') : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && activeTab === 'miners' && (
          <div className="grid md:grid-cols-2 gap-6">
            {miners.length === 0 && (
              <div className="col-span-2 text-center text-gray-400 py-20">ماینری یافت نشد</div>
            )}
            {miners.map((miner, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-bold text-white">ماینر #{i + 1}</span>
                  <span className={`px-3 py-1 rounded-full text-xs ${
                    miner.status === 'online' ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'
                  }`}>
                    {miner.status === 'online' ? 'آنلاین' : 'آفلاین'}
                  </span>
                </div>
                <div className="text-gray-300 text-sm space-y-1">
                  <p>GPU: {miner.gpu_model || 'نامشخص'}</p>
                  <p>تسک‌ها: {miner.total_tasks || 0}</p>
                  <p>درآمد: {(miner.earnings || 0).toFixed(2)} KRELZ</p>
                  <p className="font-mono text-xs text-gray-500 mt-2">
                    {miner.wallet_address ? `${miner.wallet_address.slice(0, 10)}...` : '--'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && activeTab === 'stats' && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center">
              <div className="text-4xl font-bold text-white mb-2" id="statMiners">--</div>
              <div className="text-gray-300">ماینر فعال</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center">
              <div className="text-4xl font-bold text-white mb-2" id="statTasks">--</div>
              <div className="text-gray-300">تسک تکمیل شده</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center">
              <div className="text-4xl font-bold text-white mb-2" id="statTokens">--</div>
              <div className="text-gray-300">توکن سوزانده شده</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
