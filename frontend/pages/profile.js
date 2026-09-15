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

const MODELS_LIST = [
  { id: 'qwen3.6:27b', name: 'Qwen 3.6', category: 'chat' },
  { id: 'llama3.3:70b', name: 'Llama 3.3', category: 'chat' },
  { id: 'deepseek-r1:70b', name: 'DeepSeek R1', category: 'chat' },
  { id: 'llama3.1:8b', name: 'Llama 3.1', category: 'chat' },
  { id: 'qwen3-coder:30b', name: 'Qwen 3 Coder', category: 'code' },
  { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder', category: 'code' },
  { id: 'qwen3-vl:8b', name: 'Qwen 3 VL', category: 'vision' },
  { id: 'gemma4:12b', name: 'Gemma 4', category: 'vision' },
];

const CATEGORY_ICONS = { chat: '💻', code: '💻', vision: '👁️', embedding: '🔗' };

export default function Profile() {
  const { t, lang } = useLanguage();
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [dailyTokens, setDailyTokens] = useState(null);
  const [miner, setMiner] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletChoice, setWalletChoice] = useState(null);
  const [langState, setLangState] = useState('en');

  // Wallet state
  const [activeCoin, setActiveCoin] = useState('BTC');
  const [coinBalances, setCoinBalances] = useState({});
  const [walletTab, setWalletTab] = useState('balance');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletMessage, setWalletMessage] = useState('');

  // Miner registration
  const [regGpu, setRegGpu] = useState('');
  const [regRam, setRegRam] = useState('');
  const [regCpu, setRegCpu] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        fetchBalance();
        fetchMiner();
        checkWallet();
        fetchCoinBalances();
        fetchWalletHistory();
      } catch (e) {}
    }
    const savedLang = localStorage.getItem('krelz-lang') || 'en';
    setLangState(savedLang);
    setLoading(false);
  }, []);

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  };

  const fetchBalance = async () => {
    try {
      const res = await fetch('/api/token/balance', { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setBalance(data);
        setDailyTokens(data.daily_tokens);
      }
    } catch (err) {}
  };

  const fetchMiner = async () => {
    try {
      const res = await fetch('/api/miners/mine', { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setMiner(data.miner);
    } catch (err) {}
  };

  const checkWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setWallet(accounts[0]);
          setWalletConnected(true);
          if (window.ethereum.isMetaMask) setWalletChoice('metamask');
          else if (window.ethereum.isTrust || window.ethereum.isTrustWallet) setWalletChoice('trust');
        }
      } catch (err) {}
    }
  };

  const connectWallet = async (type) => {
    if (type === 'metamask') {
      if (window.ethereum?.isMetaMask) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          setWallet(accounts[0]);
          setWalletConnected(true);
          setWalletChoice('metamask');
        } catch (err) {}
      } else {
        window.open('https://metamask.io/download/', '_blank');
      }
    } else if (type === 'trust') {
      if (window.ethereum?.isTrust || window.ethereum?.isTrustWallet) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          setWallet(accounts[0]);
          setWalletConnected(true);
          setWalletChoice('trust');
        } catch (err) {}
      } else {
        window.open('https://trustwallet.com/download', '_blank');
      }
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    setWalletConnected(false);
    setWalletChoice(null);
  };

  // Coin wallet functions
  const fetchCoinBalances = async () => {
    try {
      const res = await fetch('/api/payments/balance', { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setCoinBalances(data.balances);
    } catch (err) {}
  };

  const fetchWalletHistory = async () => {
    try {
      const res = await fetch('/api/payments/history', { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setDeposits(data.deposits || []);
        setWithdrawals(data.withdrawals || []);
      }
    } catch (err) {}
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    setWalletLoading(true); setWalletMessage('');
    try {
      const res = await fetch('/api/payments/deposit/create', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ coin: activeCoin, amount: parseFloat(depositAmount) })
      });
      const data = await res.json();
      if (data.success) {
        window.open(data.invoice.url, '_blank');
        setWalletMessage(`✅ Invoice created. Complete payment in new tab.`);
        setDepositAmount('');
      } else {
        setWalletMessage(`❌ ${data.error}`);
      }
    } catch (err) { setWalletMessage('❌ Deposit failed'); }
    setWalletLoading(false);
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawAddress) return;
    setWalletLoading(true); setWalletMessage('');
    try {
      const res = await fetch('/api/payments/withdraw', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ coin: activeCoin, amount: parseFloat(withdrawAmount), toAddress: withdrawAddress })
      });
      const data = await res.json();
      if (data.success) {
        setWalletMessage(`✅ Withdrawn ${data.withdrawal.amount} ${activeCoin} (fee: ${data.withdrawal.fee})`);
        setWithdrawAmount('');
        setWithdrawAddress('');
        fetchCoinBalances();
      } else {
        setWalletMessage(`❌ ${data.error}`);
      }
    } catch (err) { setWalletMessage('❌ Withdrawal failed'); }
    setWalletLoading(false);
  };

  const switchModel = async (modelId) => {
    try {
      const res = await fetch('/api/miners/mine/model', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ model: modelId })
      });
      const data = await res.json();
      if (data.success) setMiner(prev => ({ ...prev, current_model: modelId }));
    } catch (err) {}
  };

  const registerMiner = async () => {
    if (!regGpu || !regRam || !regCpu) return;
    setRegLoading(true);
    try {
      const res = await fetch('/api/miners/register', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ gpu_model: regGpu, ram: regRam, cpu: regCpu })
      });
      const data = await res.json();
      if (data.success) { setMiner(data.miner); setRegGpu(''); setRegRam(''); setRegCpu(''); }
    } catch (err) {}
    setRegLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  };

  const handleLangChange = (newLang) => {
    setLangState(newLang);
    localStorage.setItem('krelz-lang', newLang);
    document.documentElement.dir = newLang === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
    window.location.reload();
  };

  const currentCoinBalance = coinBalances[activeCoin] || { available: 0, total_earned: 0, total_spent: 0 };
  const currentCoin = COINS.find(c => c.id === activeCoin);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return null;
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head><title>{t('profile.title')} - Krelz Network</title></Head>

      <nav className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-bold text-white">🚀 Krelz Network</a>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a href="/" className="text-white hover:text-gray-300 text-sm">← {t('nav.back')}</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-12 max-w-2xl">

        {/* Section 1: Dashboard */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-5 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">📊 {t('profile.dashboard')}</h2>
          <div className="flex items-center gap-4 mb-4">
            {user.avatar ? (
              <img src={user.avatar} alt="avatar" className="w-14 h-14 rounded-full border-2 border-white/30" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center text-white text-xl font-bold">
                {(user.name || user.email || '?')[0].toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold text-white">{user.name || 'User'}</h3>
              <p className="text-gray-400 text-sm">{user.email}</p>
              <span className="text-xs text-purple-300">{user.role}</span>
            </div>
          </div>
          {balance && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-black/20 rounded-xl p-4 text-center">
                <div className="text-xl font-bold text-green-400">{parseFloat(balance.available || 0).toFixed(2)}</div>
                <div className="text-gray-400 text-xs">{t('profile.available')}</div>
              </div>
              <div className="bg-black/20 rounded-xl p-4 text-center">
                <div className="text-xl font-bold text-blue-400">{parseFloat(balance.total_earned || 0).toFixed(2)}</div>
                <div className="text-gray-400 text-xs">{t('profile.earned')}</div>
              </div>
              <div className="bg-black/20 rounded-xl p-4 text-center">
                <div className="text-xl font-bold text-red-400">{parseFloat(balance.total_spent || 0).toFixed(2)}</div>
                <div className="text-gray-400 text-xs">{t('profile.spent')}</div>
              </div>
            </div>
          )}
          {dailyTokens && (
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-white">🕐 {t('profile.dailyTokens')}</span>
                <span className="text-sm text-gray-400">UTC 00:00</span>
              </div>
              <div className="flex gap-4 mb-2">
                <div className="flex-1">
                  <div className="text-sm text-gray-400">{t('profile.remaining')}</div>
                  <div className="text-lg font-bold text-green-400">
                    {dailyTokens.remaining} / {dailyTokens.limit}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-400">{t('profile.usedToday')}</div>
                  <div className="text-lg font-bold text-yellow-400">{dailyTokens.used}</div>
                </div>
              </div>
              <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-yellow-500 transition-all"
                  style={{ width: `${dailyTokens.limit > 0 ? (dailyTokens.used / dailyTokens.limit) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Settings */}
        <div id="settings" className="bg-white/10 backdrop-blur-lg rounded-xl p-5 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">⚙️ {t('profile.settings')}</h2>

          {/* Wallet */}
          <div className="mb-5">
            <h3 className="text-sm font-medium text-gray-300 mb-2">🔗 {t('profile.wallet')}</h3>
            <div className="bg-black/20 rounded-lg p-3">
              {walletConnected ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-green-400 text-sm">🟢 {wallet.slice(0, 6)}...{wallet.slice(-4)}</span>
                    <button onClick={disconnectWallet} className="text-red-400 hover:text-red-300 text-xs transition">
                      {t('profile.disconnect')}
                    </button>
                  </div>
                  <div className="text-xs text-gray-500">
                    {walletChoice === 'metamask' ? '🦊 MetaMask' : walletChoice === 'trust' ? '🛡️ Trust Wallet' : '🔗 Wallet'}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button onClick={() => connectWallet('metamask')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-sm ${window.ethereum?.isMetaMask ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'}`}>
                    <span className="text-lg">🦊</span>
                    <span className="flex-1 text-left">{t('profile.connectMetaMask')}</span>
                    <span className="text-xs">{window.ethereum?.isMetaMask ? '✓' : ''}</span>
                  </button>
                  <button onClick={() => connectWallet('trust')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-sm ${window.ethereum?.isTrust || window.ethereum?.isTrustWallet ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'}`}>
                    <span className="text-lg">🛡️</span>
                    <span className="flex-1 text-left">{t('profile.connectTrustWallet')}</span>
                    <span className="text-xs">{window.ethereum?.isTrust || window.ethereum?.isTrustWallet ? '✓' : ''}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Language */}
          <div className="mb-5">
            <h3 className="text-sm font-medium text-gray-300 mb-2">🌐 {t('profile.language')}</h3>
            <div className="flex gap-2">
              <button onClick={() => handleLangChange('en')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${langState === 'en' ? 'bg-purple-600 text-white' : 'bg-black/20 text-gray-400 hover:text-white'}`}>English</button>
              <button onClick={() => handleLangChange('fa')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${langState === 'fa' ? 'bg-purple-600 text-white' : 'bg-black/20 text-gray-400 hover:text-white'}`}>فارسی</button>
            </div>
          </div>

          {/* Crypto Wallet */}
          <div className="mb-5">
            <h3 className="text-sm font-medium text-gray-300 mb-2">💰 Crypto Wallet</h3>
            <div className="bg-black/20 rounded-lg p-4">
              {/* Coin Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-2 mb-3">
                {COINS.map(c => (
                  <button key={c.id} onClick={() => setActiveCoin(c.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${activeCoin === c.id ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-400 hover:text-white'}`}>
                    <span>{c.icon}</span><span>{c.id}</span>
                  </button>
                ))}
              </div>

              {/* Balance */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center">
                  <div className={`text-sm font-bold ${currentCoin?.color}`}>{currentCoinBalance.available.toFixed(4)}</div>
                  <div className="text-gray-500 text-xs">Available</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-green-400">{currentCoinBalance.total_earned.toFixed(4)}</div>
                  <div className="text-gray-500 text-xs">Earned</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-gray-400">{currentCoinBalance.total_spent.toFixed(4)}</div>
                  <div className="text-gray-500 text-xs">Spent</div>
                </div>
              </div>

              {/* Action Tabs */}
              <div className="flex gap-1 mb-3">
                {['deposit', 'withdraw', 'history'].map(tab => (
                  <button key={tab} onClick={() => setWalletTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${walletTab === tab ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-400 hover:text-white'}`}>
                    {tab === 'deposit' ? '📥' : tab === 'withdraw' ? '📤' : '📋'} {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Deposit */}
              {walletTab === 'deposit' && (
                <div>
                  <p className="text-gray-500 text-xs mb-2">Minimum: {activeCoin === 'BTC' ? '0.0001' : activeCoin === 'ETH' ? '0.001' : '1'}</p>
                  <div className="flex gap-2">
                    <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder={`Amount in ${activeCoin}`} className="flex-1 bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" min="0" step="any" />
                    <button onClick={handleDeposit} disabled={walletLoading || !depositAmount}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50">
                      Deposit
                    </button>
                  </div>
                </div>
              )}

              {/* Withdraw */}
              {walletTab === 'withdraw' && (
                <div className="space-y-2">
                  <input type="text" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder={`${activeCoin} wallet address`} className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                  <div className="flex gap-2">
                    <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder={`Amount`} className="flex-1 bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" min="0" step="any" />
                    <button onClick={handleWithdraw} disabled={walletLoading || !withdrawAmount || !withdrawAddress}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50">
                      Withdraw
                    </button>
                  </div>
                </div>
              )}

              {/* History */}
              {walletTab === 'history' && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {deposits.length === 0 && withdrawals.length === 0 ? (
                    <p className="text-gray-500 text-xs text-center py-2">No transactions</p>
                  ) : (
                    <>
                      {deposits.slice(0, 5).map((d, i) => (
                        <div key={`d${i}`} className="flex justify-between items-center py-1 text-xs border-b border-white/5">
                          <span className="text-green-400">+{parseFloat(d.amount).toFixed(4)} {d.coin}</span>
                          <span className={`${d.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}`}>{d.status}</span>
                        </div>
                      ))}
                      {withdrawals.slice(0, 5).map((w, i) => (
                        <div key={`w${i}`} className="flex justify-between items-center py-1 text-xs border-b border-white/5">
                          <span className="text-red-400">-{parseFloat(w.amount).toFixed(4)} {w.coin}</span>
                          <span className={`${w.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}`}>{w.status}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {walletMessage && <p className="text-xs text-gray-300 mt-2">{walletMessage}</p>}
            </div>
          </div>

          {/* Miner Settings */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">⛏️ {t('profile.minerSettings')}</h3>
            <div className="bg-black/20 rounded-lg p-4">
              {miner ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">{t('profile.minerStatus')}</span>
                    <span className={`text-sm font-medium ${miner.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                      {miner.status === 'online' ? `🟢 ${t('profile.online')}` : `🔴 ${t('profile.offline')}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">{t('profile.gpuModel')}</span><span className="text-white">{miner.gpu_model}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">{t('profile.ram')}</span><span className="text-white">{miner.ram}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">{t('profile.cpu')}</span><span className="text-white">{miner.cpu}</span></div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-400">{t('profile.currentModel')}</span>
                    <select value={miner.current_model || 'llama3.1:8b'} onChange={(e) => switchModel(e.target.value)}
                      className="bg-white/10 text-white text-sm px-2 py-1 rounded border border-white/20 focus:outline-none focus:ring-1 focus:ring-purple-500">
                      {MODELS_LIST.map(m => (<option key={m.id} value={m.id} className="bg-gray-800">{CATEGORY_ICONS[m.category]} {m.name}</option>))}
                    </select>
                  </div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">{t('profile.uptime')}</span><span className="text-white">{(miner.uptime || 0).toFixed(1)}%</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">{t('profile.totalTasks')}</span><span className="text-white">{miner.total_tasks || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">{t('profile.earnings')}</span><span className="text-green-400 font-medium">{(miner.earnings || 0).toFixed(4)}</span></div>
                </div>
              ) : (
                <div>
                  <p className="text-gray-400 text-sm mb-3">{t('profile.noMiner')}</p>
                  <p className="text-gray-500 text-xs mb-4">{t('profile.registerDesc')}</p>
                  <div className="space-y-2">
                    <input type="text" value={regGpu} onChange={(e) => setRegGpu(e.target.value)} placeholder={t('profile.gpuPlaceholder')}
                      className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                    <input type="text" value={regRam} onChange={(e) => setRegRam(e.target.value)} placeholder={t('profile.ramPlaceholder')}
                      className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                    <input type="text" value={regCpu} onChange={(e) => setRegCpu(e.target.value)} placeholder={t('profile.cpuPlaceholder')}
                      className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                    <button onClick={registerMiner} disabled={regLoading || !regGpu || !regRam || !regCpu}
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50">
                      {regLoading ? '...' : `⛏️ ${t('profile.register')}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button onClick={handleLogout} className="w-full bg-red-600/50 hover:bg-red-700 text-white px-4 py-3 rounded-xl transition text-sm font-medium">
          🚪 {t('profile.logout')}
        </button>
      </main>
    </div>
  );
}
