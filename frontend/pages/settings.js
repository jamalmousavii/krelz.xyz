import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGES, isRtl } from '../i18n/translations';
import Navbar from '../components/Navbar';
import authHeaders from '../utils/auth';

const COINS = [
  { id: 'BTC', name: 'Bitcoin', icon: '₿', color: 'text-orange-500', chain: 'Bitcoin' },
  { id: 'ETH', name: 'Ethereum', icon: 'Ξ', color: 'text-sky-600', chain: 'Ethereum' },
  { id: 'BNB', name: 'BNB', icon: '◆', color: 'text-amber-500', chain: 'BSC' },
  { id: 'USDT', name: 'Tether', icon: '₮', color: 'text-emerald-600', chain: 'TRC-20' },
  { id: 'TRX', name: 'Tron', icon: '◎', color: 'text-red-500', chain: 'TRC-20' },
  { id: 'DOGE', name: 'Dogecoin', icon: 'Ð', color: 'text-amber-400', chain: 'Dogecoin' },
  { id: 'XRP', name: 'Ripple', icon: '✕', color: 'text-gray-500', chain: 'Ripple' },
];

export default function Settings() {
  const { t, lang, changeLang } = useLanguage();
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletChoice, setWalletChoice] = useState(null);
  const [langOpen, setLangOpen] = useState(false);

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

  const [hasPassword, setHasPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        checkWallet();
        fetchCoinBalances();
        fetchWalletHistory();
      } catch (e) {}
    }
    setLoading(false);
  }, []);

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

  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  const currentCoinBalance = coinBalances[activeCoin] || { available: 0, total_earned: 0, total_spent: 0 };
  const currentCoin = COINS.find(c => c.id === activeCoin);

  if (loading) {
    return (
      <div className="flex-1 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/';
    return null;
  }

  return (
    <div className={`flex-1 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 ${isRtl(lang) ? 'rtl' : 'ltr'}`}>
      <Head><title>{t('profile.settings')} - Krelz Network</title></Head>

      <Navbar />

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-12 max-w-2xl">
        {/* Quick nav */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <a href="/profile" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-gray-600 border border-sky-200 hover:bg-sky-50">📊 {t('nav.dashboard')}</a>
          <a href="/miners" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-gray-600 border border-sky-200 hover:bg-sky-50">⛏️ {t('nav.miners')}</a>
          <a href="/settings" className="px-4 py-2 rounded-lg text-sm font-bold bg-sky-500 text-white">⚙️ {t('nav.settings')}</a>
        </div>

        <div className="bg-white rounded-xl border border-sky-100 shadow-sm p-5 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">⚙️ {t('profile.settings')}</h2>

          {/* Web3 Wallet */}
          <div className="mb-5">
            <h3 className="text-sm font-medium text-gray-600 mb-2">🔗 {t('profile.wallet')}</h3>
            <div className="bg-sky-50 rounded-lg p-3 border border-sky-100">
              {walletConnected ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-emerald-600 text-sm">🟢 {wallet.slice(0, 6)}...{wallet.slice(-4)}</span>
                    <button onClick={disconnectWallet} className="text-red-500 hover:text-red-600 text-xs transition">
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
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-sm ${window.ethereum?.isMetaMask ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-white text-gray-500 hover:bg-sky-100 hover:text-gray-700 border border-sky-200'}`}>
                    <span className="text-lg">🦊</span>
                    <span className="flex-1 text-left">{t('profile.connectMetaMask')}</span>
                    <span className="text-xs">{window.ethereum?.isMetaMask ? '✓' : ''}</span>
                  </button>
                  <button onClick={() => connectWallet('trust')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-sm ${window.ethereum?.isTrust || window.ethereum?.isTrustWallet ? 'bg-sky-500 hover:bg-sky-600 text-white' : 'bg-white text-gray-500 hover:bg-sky-100 hover:text-gray-700 border border-sky-200'}`}>
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
            <h3 className="text-sm font-medium text-gray-600 mb-2">🌐 {t('profile.language')}</h3>
            <div className="relative" style={{ position: 'relative' }}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="w-full flex items-center gap-3 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 transition min-h-[44px]"
              >
                <span className="text-base leading-none">{currentLang.flag}</span>
                <span className="flex-1 text-left">{currentLang.name}</span>
                <span className="text-gray-400 text-xs">▼</span>
              </button>
              {langOpen && (
                <div className="absolute left-0 right-0 mt-1 max-h-[300px] overflow-y-auto bg-white border border-sky-200 rounded-xl shadow-xl z-50 py-1">
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => { changeLang(l.code); setLangOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition text-left min-h-[44px] ${
                        lang === l.code ? 'bg-sky-50 text-sky-700 font-bold' : 'text-gray-700 hover:bg-sky-50'
                      }`}
                    >
                      <span className="text-base leading-none w-5">{l.flag}</span>
                      <span className="flex-1 truncate">{l.name}</span>
                      {lang === l.code && <span className="text-sky-500 text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Crypto Wallet */}
          <div className="mb-5">
            <h3 className="text-sm font-medium text-gray-600 mb-2">💰 Crypto Wallet</h3>
            <div className="bg-sky-50 rounded-lg p-4 border border-sky-100">
              <div className="flex gap-1 overflow-x-auto pb-2 mb-3">
                {COINS.map(c => (
                  <button key={c.id} onClick={() => setActiveCoin(c.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${activeCoin === c.id ? 'bg-sky-500 text-white' : 'bg-white text-gray-500 hover:bg-sky-100 border border-sky-200'}`}>
                    <span>{c.icon}</span><span>{c.id}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center">
                  <div className={`text-sm font-bold ${currentCoin?.color}`}>{parseFloat(currentCoinBalance.available).toFixed(4)}</div>
                  <div className="text-gray-500 text-xs">Available</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-emerald-600">{parseFloat(currentCoinBalance.total_earned).toFixed(4)}</div>
                  <div className="text-gray-500 text-xs">Earned</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-gray-500">{parseFloat(currentCoinBalance.total_spent).toFixed(4)}</div>
                  <div className="text-gray-500 text-xs">Spent</div>
                </div>
              </div>

              <div className="flex gap-1 mb-3">
                {['deposit', 'withdraw', 'history'].map(tab => (
                  <button key={tab} onClick={() => setWalletTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${walletTab === tab ? 'bg-sky-500 text-white' : 'bg-white text-gray-500 hover:bg-sky-100 border border-sky-200'}`}>
                    {tab === 'deposit' ? '📥' : tab === 'withdraw' ? '📤' : '📋'} {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {walletTab === 'deposit' && (
                <div>
                  <p className="text-gray-500 text-xs mb-2">Minimum: {activeCoin === 'BTC' ? '0.0001' : activeCoin === 'ETH' ? '0.001' : '1'}</p>
                  <div className="flex gap-2">
                    <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder={`Amount in ${activeCoin}`} className="flex-1 bg-white text-gray-800 placeholder-gray-400 border border-sky-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" min="0" step="any" />
                    <button onClick={handleDeposit} disabled={walletLoading || !depositAmount}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50">
                      Deposit
                    </button>
                  </div>
                </div>
              )}

              {walletTab === 'withdraw' && (
                <div className="space-y-2">
                  <input type="text" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder={`${activeCoin} wallet address`} className="w-full bg-white text-gray-800 placeholder-gray-400 border border-sky-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                  <div className="flex gap-2">
                    <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder={`Amount`} className="flex-1 bg-white text-gray-800 placeholder-gray-400 border border-sky-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" min="0" step="any" />
                    <button onClick={handleWithdraw} disabled={walletLoading || !withdrawAmount || !withdrawAddress}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50">
                      Withdraw
                    </button>
                  </div>
                </div>
              )}

              {walletTab === 'history' && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {deposits.length === 0 && withdrawals.length === 0 ? (
                    <p className="text-gray-500 text-xs text-center py-2">No transactions</p>
                  ) : (
                    <>
                      {deposits.slice(0, 5).map((d, i) => (
                        <div key={`d${i}`} className="flex justify-between items-center py-1 text-xs border-b border-sky-100">
                          <span className="text-emerald-600">+{parseFloat(d.amount).toFixed(4)} {d.coin}</span>
                          <span className={`${d.status === 'completed' ? 'text-emerald-600' : 'text-amber-500'}`}>{d.status}</span>
                        </div>
                      ))}
                      {withdrawals.slice(0, 5).map((w, i) => (
                        <div key={`w${i}`} className="flex justify-between items-center py-1 text-xs border-b border-sky-100">
                          <span className="text-red-500">-{parseFloat(w.amount).toFixed(4)} {w.coin}</span>
                          <span className={`${w.status === 'completed' ? 'text-emerald-600' : 'text-amber-500'}`}>{w.status}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {walletMessage && <p className="text-xs text-gray-600 mt-2">{walletMessage}</p>}
            </div>
          </div>

          {/* Password */}
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">🔐 {t('profile.password')}</h3>
            {!hasPassword ? (
              <div className="space-y-3">
                <p className="text-gray-500 text-sm">{t('profile.setPasswordDesc')}</p>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('profile.newPassword')} className="w-full bg-white text-gray-800 placeholder-gray-400 border border-sky-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('profile.confirmPassword')} className="w-full bg-white text-gray-800 placeholder-gray-400 border border-sky-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                <button onClick={handleSetPassword} disabled={passwordLoading === 'set' || !newPassword || !confirmPassword}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50">
                  {passwordLoading === 'set' ? '...' : `🔑 ${t('profile.setPassword')}`}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-500 text-sm">{t('profile.changePasswordDesc')}</p>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('profile.currentPassword')} className="w-full bg-white text-gray-800 placeholder-gray-400 border border-sky-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('profile.newPassword')} className="w-full bg-white text-gray-800 placeholder-gray-400 border border-sky-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('profile.confirmPassword')} className="w-full bg-white text-gray-800 placeholder-gray-400 border border-sky-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                <button onClick={handleChangePassword} disabled={passwordLoading === 'change' || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50">
                  {passwordLoading === 'change' ? '...' : `🔑 ${t('profile.changePassword')}`}
                </button>
              </div>
            )}
            {passwordMessage && <p className="text-xs text-gray-600 mt-2">{passwordMessage}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
