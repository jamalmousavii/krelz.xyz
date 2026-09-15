import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Wallet() {
  const { t, lang } = useLanguage();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
  }, []);

  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/token/balance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setBalance(data);
    } catch (err) { console.error('Error:', err); }
  };

  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/payments/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setTransactions(data.transactions);
    } catch (err) { console.error('Error:', err); }
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    setLoading(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/token/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: parseFloat(depositAmount) })
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ Deposited ${depositAmount} KRELZ`);
        setDepositAmount('');
        fetchBalance();
        fetchTransactions();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      setMessage('❌ Deposit failed');
    }
    setLoading(false);
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head><title>Wallet - Krelz Network</title></Head>

      <nav className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-bold text-white">🚀 Krelz Network</a>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a href="/" className="text-white hover:text-gray-300 text-sm">← Home</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-12 max-w-2xl">
        <h1 className="text-2xl md:text-4xl font-bold text-white text-center mb-6 md:mb-8">💰 Wallet</h1>

        {balance && (
          <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 md:p-6 text-center">
              <div className="text-2xl md:text-3xl font-bold text-green-400">{balance.available.toFixed(2)}</div>
              <div className="text-gray-300 text-sm">Available KRELZ</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 md:p-6 text-center">
              <div className="text-2xl md:text-3xl font-bold text-blue-400">{balance.staked.toFixed(2)}</div>
              <div className="text-gray-300 text-sm">Staked KRELZ</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 md:p-6 text-center">
              <div className="text-2xl md:text-3xl font-bold text-purple-400">{balance.total_earned.toFixed(2)}</div>
              <div className="text-gray-300 text-sm">Total Earned</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 md:p-6 text-center">
              <div className="text-2xl md:text-3xl font-bold text-yellow-400">{balance.total_spent.toFixed(2)}</div>
              <div className="text-gray-300 text-sm">Total Spent</div>
            </div>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-5 md:p-8 mb-6 md:mb-8">
          <h2 className="text-lg md:text-xl font-bold text-white mb-4">Deposit KRELZ</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 bg-white/10 text-white placeholder-gray-400 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              min="0"
              step="0.01"
            />
            <button
              onClick={handleDeposit}
              disabled={loading || !depositAmount}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl transition disabled:opacity-50 font-bold text-sm"
            >
              {loading ? 'Processing...' : 'Deposit'}
            </button>
          </div>
          {message && <p className="mt-3 text-sm text-gray-300">{message}</p>}
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-5 md:p-8">
          <h2 className="text-lg md:text-xl font-bold text-white mb-4">Transaction History</h2>
          {transactions.length === 0 ? (
            <p className="text-gray-400 text-center py-6 text-sm">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 20).map((tx, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-black/30 rounded-lg text-sm">
                  <div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      tx.type === 'deposit' ? 'bg-green-800 text-green-300' :
                      tx.type === 'transfer' ? 'bg-blue-800 text-blue-300' :
                      'bg-gray-800 text-gray-300'
                    }`}>
                      {tx.type}
                    </span>
                  </div>
                  <div className="text-white font-mono">
                    {tx.type === 'deposit' ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)} KRELZ
                  </div>
                  <div className="text-gray-400 text-xs hidden sm:block">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
