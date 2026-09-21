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

function ResourceBar({ label, value, color }) {
  const safeValue = Math.min(Math.max(parseFloat(value) || 0, 0), 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 text-xs w-10">{label}</span>
      <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${safeValue}%` }} />
      </div>
      <span className="text-gray-300 text-xs w-10 text-right">{safeValue.toFixed(1)}%</span>
    </div>
  );
}

export default function Profile() {
  const { t, lang } = useLanguage();
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [dailyTokens, setDailyTokens] = useState(null);
  const [miner, setMiner] = useState(null);
  // Multi-miner list (v3.12.0+); `miner` kept for backward compat (first miner)
  const [miners, setMiners] = useState([]);
  const [editingMinerId, setEditingMinerId] = useState(null);
  const [minerNameInput, setMinerNameInput] = useState('');
  const [minerMsg, setMinerMsg] = useState('');
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

  // Miner token
  const [minerToken, setMinerToken] = useState('');
  const [minerTokenLoading, setMinerTokenLoading] = useState(false);
  const [minerTokenCopied, setMinerTokenCopied] = useState(false);

  // Password
  const [hasPassword, setHasPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

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
      if (data.success) {
        const list = data.miners || (data.miner ? [data.miner] : []);
        setMiners(list);
        setMiner(list[0] || null);
      }
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

  const switchModel = async (modelId, minerId) => {
    try {
      const res = await fetch('/api/miners/mine/model', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ model: modelId, miner_id: minerId || undefined })
      });
      const data = await res.json();
      if (data.success) {
        const updatedId = minerId || data.miner?.id;
        setMiners(prev => prev.map(m => m.id === updatedId ? { ...m, current_model: modelId } : m));
        setMiner(prev => (prev && (!minerId || prev.id === minerId)) ? { ...prev, current_model: modelId } : prev);
      }
    } catch (err) {}
  };

  const renameMiner = async (minerId) => {
    if (!minerNameInput.trim()) return;
    try {
      const res = await fetch(`/api/miners/mine/${minerId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ name: minerNameInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setMiners(prev => prev.map(m => m.id === minerId ? { ...m, name: minerNameInput.trim() } : m));
        setEditingMinerId(null);
        setMinerNameInput('');
      } else {
        setMinerMsg(`❌ ${data.error}`);
      }
    } catch (err) { setMinerMsg('❌ Rename failed'); }
  };

  const deleteMiner = async (minerId, minerName) => {
    if (!window.confirm(t('profile.confirmRemoveMiner'))) return;
    try {
      const res = await fetch(`/api/miners/mine/${minerId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setMiners(prev => prev.filter(m => m.id !== minerId));
        setMiner(prev => (prev && prev.id === minerId ? null : prev));
        setMinerMsg(`✅ ${minerName || ''} ${t('profile.minerRemoved')}`);
        fetchMiner();
      } else {
        setMinerMsg(`❌ ${data.error}`);
      }
    } catch (err) { setMinerMsg('❌ Remove failed'); }
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

  // Miner token functions
  const fetchMinerToken = async () => {
    setMinerTokenLoading(true);
    try {
      const res = await fetch('/api/miners/token', {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setMinerToken(data.miner_token);
      } else {
        console.error('Miner token error:', data.error);
      }
    } catch (err) {
      console.error('Miner token fetch error:', err);
    }
    setMinerTokenLoading(false);
  };

  const copyMinerToken = () => {
    navigator.clipboard.writeText(minerToken);
    setMinerTokenCopied(true);
    setTimeout(() => setMinerTokenCopied(false), 2000);
  };

  // Password functions
  const handleSetPassword = async () => {
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setPasswordMessage('❌ Passwords do not match');
      return;
    }
    setPasswordLoading('set');
    setPasswordMessage('');
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ password: newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setPasswordMessage('✅ Password set successfully');
        setHasPassword(true);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMessage(`❌ ${data.error}`);
      }
    } catch (err) { setPasswordMessage('❌ Failed to set password'); }
    setPasswordLoading('');
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setPasswordMessage('❌ Passwords do not match');
      return;
    }
    setPasswordLoading('change');
    setPasswordMessage('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setPasswordMessage('✅ Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMessage(`❌ ${data.error}`);
      }
    } catch (err) { setPasswordMessage('❌ Failed to change password'); }
    setPasswordLoading('');
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
                  <div className={`text-sm font-bold ${currentCoin?.color}`}>{parseFloat(currentCoinBalance.available).toFixed(4)}</div>
                  <div className="text-gray-500 text-xs">Available</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-green-400">{parseFloat(currentCoinBalance.total_earned).toFixed(4)}</div>
                  <div className="text-gray-500 text-xs">Earned</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-gray-400">{parseFloat(currentCoinBalance.total_spent).toFixed(4)}</div>
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

          {/* Miner Settings — multi-miner list (v3.12.0+) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-300">⛏️ {t('profile.minerSettings')} {miners.length > 0 && <span className="text-gray-500">({miners.length})</span>}</h3>
            </div>
            {minerMsg && <p className="text-xs text-gray-300 mb-2">{minerMsg}</p>}
            <div className="bg-black/20 rounded-lg p-4">
              {miners.length > 0 ? (
                <div className="space-y-4">
                  {miners.map((m) => (
                  <div key={m.id} className="bg-black/20 rounded-lg p-3 space-y-3 border border-white/5">
                    <div className="flex items-center justify-between">
                      {editingMinerId === m.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input type="text" value={minerNameInput} onChange={(e) => setMinerNameInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') renameMiner(m.id); if (e.key === 'Escape') setEditingMinerId(null); }}
                            placeholder={t('profile.minerNamePlaceholder')}
                            className="flex-1 bg-white/10 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                          <button onClick={() => renameMiner(m.id)} className="text-green-400 hover:text-green-300 text-sm">✓</button>
                          <button onClick={() => setEditingMinerId(null)} className="text-gray-400 hover:text-white text-sm">✕</button>
                        </div>
                      ) : (
                        <>
                          <span className="text-white text-sm font-medium truncate">{m.name || `${t('profile.miner')} #${m.id}`}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => { setEditingMinerId(m.id); setMinerNameInput(m.name || ''); }}
                              className="text-gray-400 hover:text-white text-xs" title={t('profile.rename')}>✏️</button>
                            <button onClick={() => deleteMiner(m.id, m.name)}
                              className="text-red-400 hover:text-red-300 text-xs" title={t('profile.remove')}>🗑️</button>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">{t('profile.minerStatus')}</span>
                      <span className={`text-sm font-medium ${m.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                        {m.status === 'online' ? `🟢 ${t('profile.online')}` : `🔴 ${t('profile.offline')}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">{t('profile.gpuModel')}</span><span className="text-white">{m.gpu_model || 'N/A'}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">{t('profile.ram')}</span><span className="text-white">{m.ram || 'N/A'}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">{t('profile.cpu')}</span><span className="text-white">{m.cpu || 'N/A'}</span></div>

                    {/* Resource Usage Bars */}
                    {(m.cpu_usage > 0 || m.ram_usage > 0 || m.gpu_usage > 0 || m.disk_usage > 0) && (
                      <div className="bg-black/30 rounded-lg p-3 space-y-2">
                        <p className="text-gray-400 text-xs font-medium mb-2">📊 {t('profile.resourceUsage')}</p>
                        <ResourceBar label="CPU" value={m.cpu_usage} color="from-blue-500 to-cyan-500" />
                        <ResourceBar label="RAM" value={m.ram_usage} color="from-green-500 to-emerald-500" />
                        {m.gpu_usage > 0 && (
                          <ResourceBar label="GPU" value={m.gpu_usage} color="from-purple-500 to-pink-500" />
                        )}
                        <ResourceBar label="Disk" value={m.disk_usage} color="from-yellow-500 to-orange-500" />
                      </div>
                    )}
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-gray-400">{t('profile.currentModel')}</span>
                      <select value={m.current_model || 'llama3.1:8b'} onChange={(e) => switchModel(e.target.value, m.id)}
                        className="bg-white/10 text-white text-sm px-2 py-1 rounded border border-white/20 focus:outline-none focus:ring-1 focus:ring-purple-500">
                        {MODELS_LIST.map(md => (<option key={md.id} value={md.id} className="bg-gray-800">{CATEGORY_ICONS[md.category]} {md.name}</option>))}
                      </select>
                    </div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">{t('profile.uptime')}</span><span className="text-white">{parseFloat(m.uptime || 0).toFixed(1)}%</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">{t('profile.totalTasks')}</span><span className="text-white">{m.total_tasks || 0}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">{t('profile.earnings')}</span><span className="text-green-400 font-medium">{parseFloat(m.earnings || 0).toFixed(4)}</span></div>
                  </div>
                  ))}
                  <p className="text-gray-500 text-xs">{t('profile.addMinerDesc')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-gray-400 text-sm">{t('profile.noMiner')}</p>
                  <p className="text-gray-500 text-xs">{t('profile.minerInstallDesc')}</p>
                </div>
              )}
              {/* Miner Token — always visible */}
              <div className="bg-black/30 rounded-lg p-3 mt-3">
                <p className="text-gray-400 text-xs mb-2">🔗 {t('profile.minerToken')}</p>
                {minerToken ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-green-400 text-xs break-all bg-black/30 px-2 py-1 rounded">{minerToken}</code>
                    <button onClick={copyMinerToken}
                      className={`px-3 py-1 rounded text-xs font-bold transition ${minerTokenCopied ? 'bg-green-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}>
                      {minerTokenCopied ? '✓' : '📋'}
                    </button>
                  </div>
                ) : (
                  <button onClick={fetchMinerToken} disabled={minerTokenLoading}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50">
                    {minerTokenLoading ? '...' : `🔑 ${t('profile.getMinerToken')}`}
                  </button>
                )}
                <p className="text-gray-600 text-xs mt-2">{t('profile.minerTokenDesc')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Password */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-5 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">🔐 {t('profile.password')}</h2>
          {!hasPassword ? (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm">{t('profile.setPasswordDesc')}</p>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('profile.newPassword')} className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('profile.confirmPassword')} className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
              <button onClick={handleSetPassword} disabled={passwordLoading === 'set' || !newPassword || !confirmPassword}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50">
                {passwordLoading === 'set' ? '...' : `🔑 ${t('profile.setPassword')}`}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm">{t('profile.changePasswordDesc')}</p>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('profile.currentPassword')} className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('profile.newPassword')} className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('profile.confirmPassword')} className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
              <button onClick={handleChangePassword} disabled={passwordLoading === 'change' || !currentPassword || !newPassword || !confirmPassword}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50">
                {passwordLoading === 'change' ? '...' : `🔑 ${t('profile.changePassword')}`}
              </button>
            </div>
          )}
          {passwordMessage && <p className="text-xs text-gray-300 mt-2">{passwordMessage}</p>}
        </div>

        {/* Logout */}
        <button onClick={handleLogout} className="w-full bg-red-600/50 hover:bg-red-700 text-white px-4 py-3 rounded-xl transition text-sm font-medium">
          🚪 {t('profile.logout')}
        </button>
      </main>
    </div>
  );
}
