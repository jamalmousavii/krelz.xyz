import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { isRtl } from '../i18n/translations';
import Navbar from '../components/Navbar';
import authHeaders from '../utils/auth';

export default function Profile() {
  const { t, lang } = useLanguage();
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [usdBalance, setUsdBalance] = useState(null);
  const [dailyTokens, setDailyTokens] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        fetchBalance();
        fetchUsdBalance();
      } catch (e) {}
    }
    setLoading(false);
  }, []);

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

  const fetchUsdBalance = async () => {
    try {
      const res = await fetch('/api/payments/balance', { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.balances?.USD) setUsdBalance(data.balances.USD);
    } catch (err) {}
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

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
      <Head><title>{t('profile.dashboard')} - Krelz Network</title></Head>

      <Navbar />

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-12 max-w-2xl">
        {/* Quick nav */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <a href="/profile" className="px-4 py-2 rounded-lg text-sm font-bold bg-sky-500 text-white">📊 {t('nav.dashboard')}</a>
          <a href="/miners" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-gray-600 border border-sky-200 hover:bg-sky-50">⛏️ {t('nav.miners')}</a>
          <a href="/settings" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-gray-600 border border-sky-200 hover:bg-sky-50">⚙️ {t('nav.settings')}</a>
        </div>

        {/* Dashboard card */}
        <div className="bg-white rounded-xl border border-sky-100 shadow-sm p-5 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📊 {t('profile.dashboard')}</h2>
          <div className="flex items-center gap-4 mb-4">
            {user.avatar ? (
              <img src={user.avatar} alt="avatar" className="w-14 h-14 rounded-full border-2 border-sky-200" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-sky-500 flex items-center justify-center text-white text-xl font-bold">
                {(user.name || user.email || '?')[0].toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold text-gray-800">{user.name || 'User'}</h3>
              <p className="text-gray-500 text-sm">{user.email}</p>
              <span className="text-xs text-sky-600">{user.role}</span>
            </div>
          </div>
          {usdBalance && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-sky-50 rounded-xl p-4 text-center border border-sky-100">
                <div className="text-xl font-bold text-emerald-600">${parseFloat(usdBalance.available || 0).toFixed(2)}</div>
                <div className="text-gray-500 text-xs">{t('profile.available')}</div>
              </div>
              <div className="bg-sky-50 rounded-xl p-4 text-center border border-sky-100">
                <div className="text-xl font-bold text-sky-600">${parseFloat(usdBalance.total_earned || 0).toFixed(2)}</div>
                <div className="text-gray-500 text-xs">{t('profile.earned')}</div>
              </div>
              <div className="bg-sky-50 rounded-xl p-4 text-center border border-sky-100">
                <div className="text-xl font-bold text-red-500">${parseFloat(usdBalance.total_spent || 0).toFixed(2)}</div>
                <div className="text-gray-500 text-xs">{t('profile.spent')}</div>
              </div>
            </div>
          )}
          {dailyTokens && (
            <div className="bg-gradient-to-r from-sky-50 to-cyan-50 rounded-xl p-4 border border-sky-100">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-gray-700">🕐 {t('profile.dailyTokens')}</span>
                <span className="text-sm text-gray-400">UTC 00:00</span>
              </div>
              <div className="flex gap-4 mb-2">
                <div className="flex-1">
                  <div className="text-sm text-gray-500">{t('profile.remaining')}</div>
                  <div className="text-lg font-bold text-emerald-600">
                    {dailyTokens.remaining} / {dailyTokens.limit}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-500">{t('profile.usedToday')}</div>
                  <div className="text-lg font-bold text-amber-500">{dailyTokens.used}</div>
                </div>
              </div>
              <div className="h-2 bg-sky-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-cyan-400 transition-all"
                  style={{ width: `${dailyTokens.limit > 0 ? (dailyTokens.used / dailyTokens.limit) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Logout */}
        <button onClick={handleLogout} className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-3 rounded-xl transition text-sm font-medium">
          🚪 {t('profile.logout')}
        </button>
      </main>
    </div>
  );
}
