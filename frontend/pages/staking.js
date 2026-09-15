import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Staking() {
  const { lang } = useLanguage();
  const [balance, setBalance] = useState(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { fetchBalance(); }, []);

  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/token/balance', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setBalance(data);
    } catch (err) {}
  };

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
    setLoading(true); setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/token/stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: parseFloat(stakeAmount) })
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ Staked ${stakeAmount} KRELZ`);
        setStakeAmount('');
        fetchBalance();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) { setMessage('❌ Staking failed'); }
    setLoading(false);
  };

  const handleUnstake = async () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) return;
    setLoading(true); setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/token/unstake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: parseFloat(unstakeAmount) })
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ Unstaked ${unstakeAmount} KRELZ`);
        setUnstakeAmount('');
        fetchBalance();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) { setMessage('❌ Unstaking failed'); }
    setLoading(false);
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head><title>Staking - Krelz Network</title></Head>
      <nav className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-bold text-white">🚀 Krelz Network</a>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a href="/" className="text-white hover:text-gray-300 text-sm">← Home</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-12 max-w-lg">
        <h1 className="text-2xl md:text-4xl font-bold text-white text-center mb-6 md:mb-8">🔒 Staking</h1>

        {balance && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-xl font-bold text-green-400">{balance.available.toFixed(2)}</div>
              <div className="text-gray-300 text-xs">Available</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-xl font-bold text-blue-400">{balance.staked.toFixed(2)}</div>
              <div className="text-gray-300 text-xs">Staked</div>
            </div>
          </div>
        )}

        <div className="bg-white/10 rounded-xl p-5 md:p-6 mb-4">
          <h2 className="text-lg font-bold text-white mb-4">Stake KRELZ</h2>
          <p className="text-gray-400 text-xs mb-4">Lock your KRELZ tokens to support the network and earn rewards.</p>
          <div className="flex gap-2">
            <input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="Amount" className="flex-1 bg-white/10 text-white placeholder-gray-400 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              min="0" step="0.01" />
            <button onClick={handleStake} disabled={loading || !stakeAmount}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition disabled:opacity-50 font-bold text-sm">
              Stake
            </button>
          </div>
        </div>

        <div className="bg-white/10 rounded-xl p-5 md:p-6 mb-4">
          <h2 className="text-lg font-bold text-white mb-4">Unstake KRELZ</h2>
          <p className="text-gray-400 text-xs mb-4">Withdraw your staked tokens back to available balance.</p>
          <div className="flex gap-2">
            <input type="number" value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder="Amount" className="flex-1 bg-white/10 text-white placeholder-gray-400 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              min="0" step="0.01" />
            <button onClick={handleUnstake} disabled={loading || !unstakeAmount}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl transition disabled:opacity-50 font-bold text-sm">
              Unstake
            </button>
          </div>
        </div>

        {message && <p className="text-center text-sm text-gray-300 mt-4">{message}</p>}
      </main>
    </div>
  );
}
