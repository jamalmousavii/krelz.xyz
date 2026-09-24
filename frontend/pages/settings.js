import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGES, isRtl } from '../i18n/translations';
import Navbar from '../components/Navbar';
import authHeaders from '../utils/auth';

export default function Settings() {
  const { t, lang, changeLang } = useLanguage();
  const [user, setUser] = useState(null);
  const [langOpen, setLangOpen] = useState(false);

  const [usdBalance, setUsdBalance] = useState({ available: 0, total_earned: 0, total_spent: 0 });
  const [walletTab, setWalletTab] = useState('topup');
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
        fetchBalance();
        fetchHistory();
      } catch (e) {}
    }
    setLoading(false);
  }, []);

  const fetchBalance = async () => {
    try {
      const res = await fetch('/api/payments/balance', { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.balances?.USD) setUsdBalance(data.balances.USD);
    } catch (err) {}
  };

  const fetchHistory = async () => {
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
        body: JSON.stringify({ amount_usd: parseFloat(depositAmount) })
      });
      const data = await res.json();
      if (data.success) {
        window.open(data.invoice.url, '_blank');
        setWalletMessage('✅ Invoice created. Complete payment in new tab.');
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
        body: JSON.stringify({ amount: parseFloat(withdrawAmount), toAddress: withdrawAddress })
      });
      const data = await res.json();
      if (data.success) {
        setWalletMessage(`✅ Sent $${data.withdrawal.amount} via USDT TRC-20 (fee: $${data.withdrawal.fee})`);
        setWithdrawAmount('');
        setWithdrawAddress('');
        fetchBalance();
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

          {/* USD Wallet */}
          <div className="mb-5">
            <h3 className="text-sm font-medium text-gray-600 mb-2">💰 Wallet (USD)</h3>
            <div className="bg-sky-50 rounded-lg p-4 border border-sky-100">
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-600">${parseFloat(usdBalance.available || 0).toFixed(2)}</div>
                  <div className="text-gray-500 text-xs">Available</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-sky-600">${parseFloat(usdBalance.total_earned || 0).toFixed(2)}</div>
                  <div className="text-gray-500 text-xs">Earned</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-500">${parseFloat(usdBalance.total_spent || 0).toFixed(2)}</div>
                  <div className="text-gray-500 text-xs">Spent</div>
                </div>
              </div>

              <div className="flex gap-1 mb-3">
                {['topup', 'withdraw', 'history'].map(tab => (
                  <button key={tab} onClick={() => setWalletTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] ${walletTab === tab ? 'bg-sky-500 text-white' : 'bg-white text-gray-500 hover:bg-sky-100 border border-sky-200'}`}>
                    {tab === 'topup' ? '📥 Top Up' : tab === 'withdraw' ? '📤 Withdraw' : '📋 History'}
                  </button>
                ))}
              </div>

              {walletTab === 'topup' && (
                <div>
                  <p className="text-gray-500 text-xs mb-2">Amount in USD — pay with any supported crypto on NowPayments</p>
                  <div className="flex gap-2">
                    <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Amount in USD" className="flex-1 bg-white text-gray-800 placeholder-gray-400 border border-sky-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" min="1" step="0.01" />
                    <button onClick={handleDeposit} disabled={walletLoading || !depositAmount}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50 min-h-[40px]">
                      Top Up
                    </button>
                  </div>
                </div>
              )}

              {walletTab === 'withdraw' && (
                <div className="space-y-2">
                  <p className="text-gray-500 text-xs">Withdraw via <strong>USDT TRC-20</strong> · Min $5 · Fee paid by you</p>
                  <input type="text" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder="USDT TRC-20 wallet address" className="w-full bg-white text-gray-800 placeholder-gray-400 border border-sky-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-400 min-h-[40px]" />
                  <div className="flex gap-2">
                    <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Amount in USD" className="flex-1 bg-white text-gray-800 placeholder-gray-400 border border-sky-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" min="5" step="0.01" />
                    <button onClick={handleWithdraw} disabled={walletLoading || !withdrawAmount || !withdrawAddress}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50 min-h-[40px]">
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
                          <span className="text-emerald-600">+${parseFloat(d.amount).toFixed(2)} USD</span>
                          <span className={`${d.status === 'completed' ? 'text-emerald-600' : 'text-amber-500'}`}>{d.status}</span>
                        </div>
                      ))}
                      {withdrawals.slice(0, 5).map((w, i) => (
                        <div key={`w${i}`} className="flex justify-between items-center py-1 text-xs border-b border-sky-100">
                          <span className="text-red-500">-${parseFloat(w.amount).toFixed(2)} USD</span>
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
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50 min-h-[44px]">
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
                  className="w-full bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg transition text-sm disabled:opacity-50 min-h-[44px]">
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
