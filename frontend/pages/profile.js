import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { isRtl } from '../i18n/translations';
import Navbar from '../components/Navbar';
import EarningsBreakdown from '../components/EarningsBreakdown';
import { useAuth, clearSession, apiFetch, ApiError } from '../utils/api';

export default function Profile() {
  const { t, lang } = useLanguage();
  const [usdBalance, setUsdBalance] = useState(null);
  const [extras, setExtras] = useState(null); // free_tokens / plan / plans / token_bundle
  const [planMsg, setPlanMsg] = useState('');
  const [bundleMsg, setBundleMsg] = useState('');
  const [bundleAmount, setBundleAmount] = useState('5'); // whole dollars for the token bundle
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

  // v3.29.1 — apiFetch: a 401 (expired JWT) clears the session and redirects
  // home via useAuth, instead of silently rendering an empty dashboard.
  const fetchUsdBalance = async () => {
    try {
      const data = await apiFetch('/api/payments/balance');
      if (data.success && data.balances?.USD) setUsdBalance(data.balances.USD);
      if (data.success && data.free_tokens) {
        setExtras({
          free_tokens: data.free_tokens,
          plan: data.plan,
          plans: data.plans || [],
          token_bundle: data.token_bundle || null,
        });
      }
    } catch (err) {}
  };

  // v3.28.0 — invoice purchases (plan tier or token bundle): hosted
  // NowPayments checkout opens in a new tab; credit/activation via IPN.
  const purchasePlan = async (tier) => {
    setPlanMsg('');
    try {
      const data = await apiFetch(`/api/plans/${tier}/purchase`, { method: 'POST' });
      if (data.success && data.invoice?.url) {
        window.open(data.invoice.url, '_blank', 'noopener');
      } else {
        setPlanMsg(`❌ ${data.error || 'Error'}`);
      }
    } catch (err) {
      setPlanMsg(`❌ ${err instanceof ApiError ? err.message : t('chat.errorConnection')}`);
    }
  };

  const purchaseTokens = async () => {
    setBundleMsg('');
    const amount = parseInt(bundleAmount, 10);
    if (!(amount >= 1 && amount <= 500)) {
      setBundleMsg(`❌ ${t('chat.bundleRange')}`);
      return;
    }
    try {
      const data = await apiFetch('/api/plans/tokens/purchase', {
        method: 'POST',
        body: JSON.stringify({ amount_usd: amount }),
      });
      if (data.success && data.invoice?.url) {
        window.open(data.invoice.url, '_blank', 'noopener');
      } else {
        setBundleMsg(`❌ ${data.error || 'Error'}`);
      }
    } catch (err) {
      setBundleMsg(`❌ ${err instanceof ApiError ? err.message : t('chat.errorConnection')}`);
    }
  };

  const formatTokens = (n) => {
    const v = Number(n || 0);
    if (v >= 1000000) return `${(v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
    return String(v);
  };

  const fetchRank = async () => {
    try {
      const mineData = await apiFetch('/api/miners/mine');
      if (!mineData.success || !mineData.miners?.length) return;
      const data = await apiFetch('/api/leaderboard/mine');
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
              {extras?.free_tokens && (
                <div className="bg-indigo-50 rounded-xl p-4 text-center border border-indigo-100">
                  <div className="text-xl font-bold text-indigo-600">{formatTokens(extras.free_tokens.remaining)}</div>
                  <div className="text-gray-600 text-xs">{t('profile.freeTokens')}</div>
                  <div className="text-gray-400 text-[10px]">{t('profile.freeTokensHint')}</div>
                </div>
              )}
              {extras?.token_bundle && (
                <div className="bg-sky-50 rounded-xl p-4 text-center border border-sky-200">
                  <div className="text-xl font-bold text-sky-700">{formatTokens(extras.token_bundle.balance)}</div>
                  <div className="text-gray-600 text-xs">{t('profile.potTokens')}</div>
                  <div className="text-gray-400 text-[10px]">{t('profile.potTokensHint')}</div>
                </div>
              )}
              {usdBalance.miner_credit?.eligible && (
                <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
                  <div className="text-xl font-bold text-amber-600">
                    ${parseFloat(usdBalance.miner_credit.remaining || 0).toFixed(2)}
                  </div>
                  <div className="text-gray-600 text-xs">{t('profile.minerCredit')}</div>
                  <div className="text-gray-400 text-[10px]">{t('profile.minerCreditHint')}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* v3.28.0 — plan catalog: Plus / Pro / Max */}
        <div className="bg-white rounded-xl border border-violet-100 shadow-sm p-5 md:p-6 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-800">⭐ {t('profile.plansTitle')}</h2>
              {extras?.plan?.active ? (
                <p className="text-sm text-emerald-600 font-medium">
                  {t('profile.planActive')
                    .replace('{label}', (extras.plans.find(p => p.name === extras.plan.name)?.label) || 'Plus')
                    .replace('{date}', new Date(extras.plan.expires_at).toLocaleDateString())}
                </p>
              ) : (
                <p className="text-sm text-gray-500">{t('profile.plansDesc')}</p>
              )}
              {!extras?.plan?.active && (
                <p className="text-xs text-gray-400 mt-0.5">{t('profile.planFreeNote')}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {(extras?.plans || []).map(p => {
              const active = extras?.plan?.active && extras.plan.name === p.name;
              return (
                <div key={p.name} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${active ? 'bg-emerald-50 border-emerald-200' : 'bg-sky-50 border-sky-100'}`}>
                  <div className="min-w-0 text-sm">
                    <span className="font-bold text-gray-800">{p.label}</span>
                    {active && <span className="text-emerald-600 text-xs font-semibold"> ✓ {t('profile.planBadgeActive')}</span>}
                    <div className="text-xs text-gray-600">
                      {t('profile.planRow')
                        .replace('{price}', `$${p.price}`)
                        .replace('{tokens}', Number(p.daily_tokens).toLocaleString('en-US'))}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {t('profile.planValue').replace('{value}', `$${p.value_usd_day}`)}
                    </div>
                  </div>
                  <button
                    onClick={() => purchasePlan(p.name)}
                    className={`px-4 py-2 rounded-xl transition text-sm font-bold flex-shrink-0 text-white ${active ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-violet-600 hover:bg-violet-700'}`}
                  >
                    {active ? t('profile.planRenew') : t('profile.planUpgrade')}
                  </button>
                </div>
              );
            })}
          </div>
          {planMsg && <p className="text-red-500 text-xs mt-2">{planMsg}</p>}
        </div>

        {/* v3.28.0 — token bundle ($1 = 1M, never expires) */}
        <div className="bg-white rounded-xl border border-sky-100 shadow-sm p-5 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">🎟️ {t('profile.bundleTitle')}</h2>
          <p className="text-sm text-gray-500 mb-1">
            {t('profile.bundleDesc')
              .replace('{rate}', Number(extras?.token_bundle?.tokens_per_usd || 1000000).toLocaleString('en-US'))}
          </p>
          <p className="text-xs text-gray-400 mb-3">
            {t('profile.bundleBalance').replace('{tokens}', formatTokens(extras?.token_bundle?.balance || 0))}
          </p>
          <div className="flex items-center gap-2">
            <input
              value={bundleAmount}
              onChange={(e) => setBundleAmount(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              aria-label={t('profile.bundlePlaceholder')}
              placeholder={t('profile.bundlePlaceholder')}
              className="w-28 border border-sky-200 rounded-xl px-3 py-2.5 text-sm text-center"
            />
            <button
              onClick={purchaseTokens}
              className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl transition text-sm font-bold"
            >
              {t('profile.bundleBtn')}
            </button>
          </div>
          {bundleMsg && <p className="text-red-500 text-xs mt-2">{bundleMsg}</p>}
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
                {myRank.breakdown && (
                  <EarningsBreakdown breakdown={myRank.breakdown} className="mt-3" />
                )}
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
