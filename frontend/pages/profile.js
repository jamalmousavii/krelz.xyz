import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { isRtl } from '../i18n/translations';
import Navbar from '../components/Navbar';
import authHeaders from '../utils/auth';
import { useAuth, clearSession } from '../utils/api';

export default function Profile() {
  const { t, lang } = useLanguage();
  const [usdBalance, setUsdBalance] = useState(null);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  const { ready, user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchUsdBalance();
      fetchRank();
    }
    setLoading(false);
  }, [user]);

  const fetchUsdBalance = async () => {
    try {
      const res = await fetch('/api/payments/balance', { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.balances?.USD) setUsdBalance(data.balances.USD);
    } catch (err) {}
  };

  const fetchRank = async () => {
    try {
      const mine = await fetch('/api/miners/mine', { headers: authHeaders() });
      const mineData = await mine.json();
      if (!mineData.success || !mineData.miners?.length) return;
      const res = await fetch('/api/leaderboard/mine', { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setMyRank(data);
    } catch (err) {}
  };

  const handleLogout = () => {
    clearSession();
    window.location.href = '/';
  };

  if (loading || !user) {
    return (
      <div className="flex-1 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`flex-1 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 ${isRtl(lang) ? 'rtl' : 'ltr'}`}>
      <Head><title>{t('profile.dashboard')} - Krelz Network</title></Head>

      <Navbar />

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-12 max-w-2xl">
        {/* Quick nav */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Link href="/profile" className="px-4 py-2 min-h-[40px] inline-flex items-center rounded-lg text-sm font-bold bg-sky-500 text-white">📊 {t('nav.dashboard')}</Link>
          <Link href="/miners" className="px-4 py-2 min-h-[40px] inline-flex items-center rounded-lg text-sm font-bold bg-white text-gray-600 border border-sky-200 hover:bg-sky-50">⛏️ {t('nav.miners')}</Link>
          <Link href="/settings" className="px-4 py-2 min-h-[40px] inline-flex items-center rounded-lg text-sm font-bold bg-white text-gray-600 border border-sky-200 hover:bg-sky-50">⚙️ {t('nav.settings')}</Link>
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
              <p className="text-gray-500 text-sm break-all">{user.email}</p>
              <span className="text-xs text-sky-600">{user.role}</span>
            </div>
          </div>
          {usdBalance && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
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
        </div>

        {/* Leaderboard rank (miners only) */}
        {myRank?.isMiner && (
          <div className="bg-white rounded-xl border border-sky-100 shadow-sm p-5 md:p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">🏆 {t('profile.myRank')}</h2>
              <Link href="/leaderboard" className="text-sm font-semibold text-sky-600 hover:text-sky-700 transition">
                {t('profile.viewLeaderboard')} →
              </Link>
            </div>
            {myRank.rank ? (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 border-2 border-amber-300 flex items-center justify-center text-2xl font-black text-amber-600">
                    {myRank.rank}
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">{t('profile.rankOf').replace('{rank}', myRank.rank).replace('{total}', myRank.total)}</div>
                    <div className="text-xs text-gray-400">⛏️ {myRank.miner?.gpu_model || 'GPU'} • {myRank.miner?.total_tasks || 0} {t('profile.rankTasks')}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-sky-50 rounded-xl p-4 text-center border border-sky-100">
                    <div className="text-xl font-bold text-emerald-600">{Number(myRank.miner?.earnings || 0).toFixed(2)}</div>
                    <div className="text-gray-500 text-xs">{t('profile.rankEarnings')}</div>
                  </div>
                  <div className="bg-sky-50 rounded-xl p-4 text-center border border-sky-100">
                    <div className="text-xl font-bold text-sky-600">{myRank.total || 0}</div>
                    <div className="text-gray-500 text-xs">{t('profile.rankMiners')}</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-sky-50 rounded-xl p-4 border border-sky-100 text-center">
                <div className="text-2xl mb-1">📈</div>
                <div className="font-semibold text-gray-700 text-sm">{t('profile.notRanked')}</div>
                <div className="text-gray-500 text-xs mt-1">{t('profile.notRankedHint')}</div>
              </div>
            )}
          </div>
        )}

        {/* Logout */}
        <button onClick={handleLogout} className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-3 rounded-xl transition text-sm font-medium">
          🚪 {t('profile.logout')}
        </button>
      </main>
    </div>
  );
}
