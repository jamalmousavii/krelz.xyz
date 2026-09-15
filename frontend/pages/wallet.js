import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const COINS = [
  { id: 'BTC', name: 'Bitcoin', icon: '₿', color: 'text-orange-400', chain: 'Bitcoin' },
  { id: 'ETH', name: 'Ethereum', icon: 'Ξ', color: 'text-blue-400', chain: 'Ethereum' },
  { id: 'BNB', name: 'BNB', icon: '◆', color: 'text-yellow-400', chain: 'BSC' },
  { id: 'USDT', name: 'Tether', icon: '₮', color: 'text-green-400', chain: 'TRC-20' },
  { id: 'TRX', name: 'Tron', icon: '◎', color: 'text-red-400', chain: 'TRC-20' },
  { id: 'DOGE', name: 'Dogecoin', icon: 'Ð', color: 'text-yellow-300', chain: 'Dogecoin' },
  { id: 'XRP', name: 'Ripple', icon: '✕', color: 'text-gray-300', chain: 'Ripple' },
];

export default function Wallet() {
  const { lang } = useLanguage();
  const [activeCoin, setActiveCoin] = useState('BTC');
  const [balances, setBalances] = useState({});
  const [tab, setTab] = useState('balance');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchBalance();
    fetchHistory();
  }, []);

  const headers = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
  };

  const fetchBalance = async () => {
    try {
      const res = await fetch('/api/payments/balance', { headers: headers() });
      const data = await res.json();
      if (data.success) setBalances(data.balances);
    } catch (err) { console.error(err); }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/payments/history', { headers: headers() });
      const data = await res.json();
      if (data.success) {
        setDeposits(data.deposits || []);
        setWithdrawals(data.withdrawals || []);
      }
    } catch (err) {}
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    setLoading(true); setMessage('');
    try {
      const res = await fetch('/api/payments/deposit/create', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ coin: activeCoin, amount: parseFloat(depositAmount) })
      });
      const data = await res.json();
      if (data.success) {
        window.open(data.invoice.url, '_blank');
        setMessage(`✅ Invoice created. Complete payment in new tab.`);
        setDepositAmount('');
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) { setMessage('❌ Deposit failed'); }
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawAddress) return;
    setLoading(true); setMessage('');
    try {
      const res = await fetch('/api/payments/withdraw', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ coin: activeCoin, amount: parseFloat(withdrawAmount), toAddress: withdrawAddress })
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ Withdrawn ${data.withdrawal.amount} ${activeCoin} (fee: ${data.withdrawal.fee})`);
        setWithdrawAmount('');
        setWithdrawAddress('');
        fetchBalance();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) { setMessage('❌ Withdrawal failed'); }
    setLoading(false);
  };

  const currentBalance = balances[activeCoin] || { available: 0, total_earned: 0, total_spent: 0 };
  const currentCoin = COINS.find(c => c.id === activeCoin);

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

        {/* Coin Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6">
          {COINS.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCoin(c.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${
                activeCoin === c.id ? 'bg-purple-600 text-white ring-2 ring-purple-400' : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <span className="text-lg">{c.icon}</span>
              <span>{c.id}</span>
            </button>
          ))}
        </div>

        {/* Balance Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-5 md:p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <span className={`text-3xl ${currentCoin?.color}`}>{currentCoin?.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-white">{currentCoin?.name}</h2>
              <p className="text-gray-400 text-xs">{currentCoin?.chain} Network</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className={`text-xl md:text-2xl font-bold ${currentCoin?.color}`}>{currentBalance.available.toFixed(4)}</div>
              <div className="text-gray-400 text-xs">Available</div>
            </div>
            <div className="text-center">
              <div className="text-xl md:text-2xl font-bold text-green-400">{currentBalance.total_earned.toFixed(4)}</div>
              <div className="text-gray-400 text-xs">Earned</div>
            </div>
            <div className="text-center">
              <div className="text-xl md:text-2xl font-bold text-gray-400">{currentBalance.total_spent.toFixed(4)}</div>
              <div className="text-gray-400 text-xs">Spent</div>
            </div>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex gap-2 mb-4">
          {['balance', 'deposit', 'withdraw', 'history'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === t ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
              {t === 'balance' ? '💰' : t === 'deposit' ? '📥' : t === 'withdraw' ? '📤' : '📋'} {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Deposit */}
        {tab === 'deposit' && (
          <div className="bg-white/10 rounded-xl p-5 md:p-6">
            <h3 className="text-lg font-bold text-white mb-3">Deposit {activeCoin}</h3>
            <p className="text-gray-400 text-xs mb-4">Send {activeCoin} to the address below. Minimum: {activeCoin === 'BTC' ? '0.0001' : activeCoin === 'ETH' ? '0.001' : '1'}</p>
            <div className="flex gap-2">
              <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                placeholder={`Amount in ${activeCoin}`} className="flex-1 bg-white/10 text-white placeholder-gray-400 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                min="0" step="any" />
              <button onClick={handleDeposit} disabled={loading || !depositAmount}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl transition disabled:opacity-50 font-bold text-sm">
                Deposit
              </button>
            </div>
          </div>
        )}

        {/* Withdraw */}
        {tab === 'withdraw' && (
          <div className="bg-white/10 rounded-xl p-5 md:p-6">
            <h3 className="text-lg font-bold text-white mb-3">Withdraw {activeCoin}</h3>
            <p className="text-gray-400 text-xs mb-4">Minimum: $10 | Fee: {activeCoin === 'BTC' ? '0.00005' : activeCoin === 'ETH' ? '0.0005' : '0.001'} {activeCoin}</p>
            <div className="space-y-3">
              <input type="text" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)}
                placeholder={`${activeCoin} wallet address`} className="w-full bg-white/10 text-white placeholder-gray-400 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
              <div className="flex gap-2">
                <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={`Amount in ${activeCoin}`} className="flex-1 bg-white/10 text-white placeholder-gray-400 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  min="0" step="any" />
                <button onClick={handleWithdraw} disabled={loading || !withdrawAmount || !withdrawAddress}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl transition disabled:opacity-50 font-bold text-sm">
                  Withdraw
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Balance Overview */}
        {tab === 'balance' && (
          <div className="space-y-2">
            {COINS.map(c => (
              <div key={c.id} className="bg-white/10 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/15 transition"
                   onClick={() => { setActiveCoin(c.id); setTab('deposit'); }}>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl ${c.color}`}>{c.icon}</span>
                  <div>
                    <span className="text-white font-bold text-sm">{c.name}</span>
                    <span className="text-gray-400 text-xs ml-2">{c.chain}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${c.color}`}>{(balances[c.id]?.available || 0).toFixed(4)}</div>
                  <div className="text-gray-400 text-xs">{c.id}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {tab === 'history' && (
          <div className="space-y-4">
            <div className="bg-white/10 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3">📥 Deposits</h3>
              {deposits.length === 0 ? (
                <p className="text-gray-400 text-xs text-center py-4">No deposits</p>
              ) : deposits.slice(0, 10).map((d, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-white/10 text-sm">
                  <span className="text-green-400">+{parseFloat(d.amount).toFixed(4)} {d.coin}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${d.status === 'completed' ? 'bg-green-800 text-green-300' : 'bg-yellow-800 text-yellow-300'}`}>{d.status}</span>
                </div>
              ))}
            </div>
            <div className="bg-white/10 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3">📤 Withdrawals</h3>
              {withdrawals.length === 0 ? (
                <p className="text-gray-400 text-xs text-center py-4">No withdrawals</p>
              ) : withdrawals.slice(0, 10).map((w, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-white/10 text-sm">
                  <span className="text-red-400">-{parseFloat(w.amount).toFixed(4)} {w.coin}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${w.status === 'completed' ? 'bg-green-800 text-green-300' : 'bg-yellow-800 text-yellow-300'}`}>{w.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {message && <p className="mt-4 text-sm text-gray-300 text-center">{message}</p>}
      </main>
    </div>
  );
}
