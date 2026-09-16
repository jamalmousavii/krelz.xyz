import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import GoogleLogin from './GoogleLogin';

export default function Navbar() {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);
  const dropdownRef = useRef(null);

  // Auth state
  const [authMode, setAuthMode] = useState('login'); // login, signup, forgot, reset
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [resetToken, setResetToken] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  };

  const handleLogin = async () => {
    if (!authEmail || !authPassword) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.reload();
      } else {
        setAuthError(data.error || 'Login failed');
      }
    } catch (err) {
      setAuthError('Network error');
    }
    setAuthLoading(false);
  };

  const handleSignup = async () => {
    if (!authEmail || !authPassword) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.reload();
      } else {
        setAuthError(data.error || 'Signup failed');
      }
    } catch (err) {
      setAuthError('Network error');
    }
    setAuthLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!authEmail) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail })
      });
      const data = await res.json();
      if (data.success) {
        if (data.reset_token) {
          setResetToken(data.reset_token);
          setAuthMode('reset');
        }
        setAuthError('');
      } else {
        setAuthError(data.error || 'Failed');
      }
    } catch (err) {
      setAuthError('Network error');
    }
    setAuthLoading(false);
  };

  const handleResetPassword = async () => {
    if (!resetToken || !authPassword) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: authPassword })
      });
      const data = await res.json();
      if (data.success) {
        setAuthMode('login');
        setAuthPassword('');
        setResetToken('');
        setAuthError('');
      } else {
        setAuthError(data.error || 'Failed');
      }
    } catch (err) {
      setAuthError('Network error');
    }
    setAuthLoading(false);
  };

  const resetAuthForm = () => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthError('');
    setResetToken('');
  };

  return (
    <nav className="container mx-auto px-4 md:px-6 py-4">
      <div className="flex items-center justify-between">
        <a href="/" className="text-xl md:text-2xl font-bold text-white">🚀 Krelz Network</a>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-4">
          <LanguageSwitcher />
          <a href="/explorer" className="text-gray-300 hover:text-white transition">{t('nav.explorer')}</a>
          <a href="/miner" className="text-gray-300 hover:text-white transition">{t('nav.miner')}</a>
          <a href="/chat" className="text-gray-300 hover:text-white transition">{t('nav.chat')}</a>
          <a href="/leaderboard" className="text-gray-300 hover:text-white transition">🏆</a>

          {/* Profile / Login Dropdown */}
          <div className="relative" ref={dropdownRef}>
            {user ? (
              <>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt="avatar" className="w-7 h-7 rounded-full border border-white/30" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold">
                      {(user.name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-white text-sm font-medium hidden lg:inline">{user.name || user.email}</span>
                  <span className="text-gray-400 text-xs">▼</span>
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-600 rounded-xl shadow-xl overflow-hidden z-50">
                    <a href="/profile" className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-white/10 transition">
                      📊 {t('profile.dashboard')}
                    </a>
                    <a href="/profile#settings" className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-white/10 transition">
                      ⚙️ {t('profile.settings')}
                    </a>
                    <hr className="border-gray-600" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-white/10 transition"
                    >
                      🚪 {t('profile.logout')}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => { setDropdownOpen(!dropdownOpen); resetAuthForm(); setAuthMode('login'); }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
                >
                  {t('nav.login')}
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-600 rounded-xl shadow-xl overflow-hidden z-50 p-5">
                    {/* Login Form */}
                    {authMode === 'login' && (
                      <div className="space-y-3">
                        <h3 className="text-white font-bold text-center">{t('nav.login')}</h3>
                        <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="Email" className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                        <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder={t('nav.password')} className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                          onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
                        {authError && <p className="text-red-400 text-xs">{authError}</p>}
                        <button onClick={handleLogin} disabled={authLoading || !authEmail || !authPassword}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium disabled:opacity-50">
                          {authLoading ? '...' : `🔑 ${t('nav.login')}`}
                        </button>
                        <button onClick={() => { setAuthMode('forgot'); resetAuthForm(); }}
                          className="w-full text-gray-400 hover:text-white text-xs transition">
                          {t('nav.forgotPassword')}
                        </button>
                        <div className="flex items-center gap-2 my-2">
                          <div className="flex-1 h-px bg-gray-600"></div>
                          <span className="text-gray-500 text-xs">{t('nav.or')}</span>
                          <div className="flex-1 h-px bg-gray-600"></div>
                        </div>
                        <GoogleLogin onSuccess={() => setDropdownOpen(false)} />
                        <p className="text-center text-gray-400 text-xs">
                          {t('nav.noAccount')}{' '}
                          <button onClick={() => { setAuthMode('signup'); resetAuthForm(); }} className="text-purple-400 hover:text-purple-300 transition">
                            {t('nav.signup')}
                          </button>
                        </p>
                      </div>
                    )}

                    {/* Signup Form */}
                    {authMode === 'signup' && (
                      <div className="space-y-3">
                        <h3 className="text-white font-bold text-center">{t('nav.signup')}</h3>
                        <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="Email" className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                        <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder={t('nav.password')} className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                          onKeyDown={(e) => e.key === 'Enter' && handleSignup()} />
                        <p className="text-gray-500 text-xs">{t('nav.passwordHint')}</p>
                        {authError && <p className="text-red-400 text-xs">{authError}</p>}
                        <button onClick={handleSignup} disabled={authLoading || !authEmail || !authPassword}
                          className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium disabled:opacity-50">
                          {authLoading ? '...' : `📧 ${t('nav.signup')}`}
                        </button>
                        <div className="flex items-center gap-2 my-2">
                          <div className="flex-1 h-px bg-gray-600"></div>
                          <span className="text-gray-500 text-xs">{t('nav.or')}</span>
                          <div className="flex-1 h-px bg-gray-600"></div>
                        </div>
                        <GoogleLogin onSuccess={() => setDropdownOpen(false)} />
                        <p className="text-center text-gray-400 text-xs">
                          {t('nav.hasAccount')}{' '}
                          <button onClick={() => { setAuthMode('login'); resetAuthForm(); }} className="text-purple-400 hover:text-purple-300 transition">
                            {t('nav.login')}
                          </button>
                        </p>
                      </div>
                    )}

                    {/* Forgot Password Form */}
                    {authMode === 'forgot' && (
                      <div className="space-y-3">
                        <h3 className="text-white font-bold text-center">{t('nav.forgotPassword')}</h3>
                        <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="Email" className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                          onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()} />
                        {authError && <p className="text-red-400 text-xs">{authError}</p>}
                        <button onClick={handleForgotPassword} disabled={authLoading || !authEmail}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium disabled:opacity-50">
                          {authLoading ? '...' : `📧 ${t('nav.sendResetLink')}`}
                        </button>
                        <button onClick={() => { setAuthMode('login'); resetAuthForm(); }}
                          className="w-full text-gray-400 hover:text-white text-xs transition">
                          ← {t('nav.backToLogin')}
                        </button>
                      </div>
                    )}

                    {/* Reset Password Form */}
                    {authMode === 'reset' && (
                      <div className="space-y-3">
                        <h3 className="text-white font-bold text-center">{t('nav.resetPassword')}</h3>
                        <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder={t('nav.newPassword')} className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                          onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()} />
                        <p className="text-gray-500 text-xs">{t('nav.passwordHint')}</p>
                        {authError && <p className="text-red-400 text-xs">{authError}</p>}
                        <button onClick={handleResetPassword} disabled={authLoading || !authPassword}
                          className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium disabled:opacity-50">
                          {authLoading ? '...' : `🔑 ${t('nav.resetPassword')}`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-white text-2xl p-2">
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden mt-4 pb-4 border-t border-white/20">
          <div className="flex flex-col gap-3 pt-4">
            <LanguageSwitcher />
            <a href="/explorer" className="text-gray-300 hover:text-white transition py-2">{t('nav.explorer')}</a>
            <a href="/miner" className="text-gray-300 hover:text-white transition py-2">{t('nav.miner')}</a>
            <a href="/chat" className="text-gray-300 hover:text-white transition py-2">{t('nav.chat')}</a>
            <a href="/leaderboard" className="text-gray-300 hover:text-white transition py-2">🏆 Leaderboard</a>

            {user ? (
              <>
                <a href="/profile" className="text-gray-300 hover:text-white transition py-2">📊 {t('profile.dashboard')}</a>
                <a href="/profile#settings" className="text-gray-300 hover:text-white transition py-2">⚙️ {t('profile.settings')}</a>
                <button onClick={handleLogout} className="text-red-400 hover:text-red-300 transition py-2 text-left">
                  🚪 {t('profile.logout')}
                </button>
              </>
            ) : (
              <div className="py-2 space-y-3">
                {/* Mobile Login Form */}
                {authMode === 'login' && (
                  <>
                    <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="Email" className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm" />
                    <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder={t('nav.password')} className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm" />
                    {authError && <p className="text-red-400 text-xs">{authError}</p>}
                    <button onClick={handleLogin} disabled={authLoading || !authEmail || !authPassword}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {authLoading ? '...' : `🔑 ${t('nav.login')}`}
                    </button>
                    <button onClick={() => { setAuthMode('forgot'); resetAuthForm(); }}
                      className="text-gray-400 hover:text-white text-xs">{t('nav.forgotPassword')}</button>
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px bg-gray-600"></div>
                      <span className="text-gray-500 text-xs">{t('nav.or')}</span>
                      <div className="flex-1 h-px bg-gray-600"></div>
                    </div>
                    <GoogleLogin />
                    <p className="text-gray-400 text-xs">
                      {t('nav.noAccount')}{' '}
                      <button onClick={() => { setAuthMode('signup'); resetAuthForm(); }} className="text-purple-400">{t('nav.signup')}</button>
                    </p>
                  </>
                )}

                {authMode === 'signup' && (
                  <>
                    <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="Email" className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm" />
                    <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder={t('nav.password')} className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm" />
                    <p className="text-gray-500 text-xs">{t('nav.passwordHint')}</p>
                    {authError && <p className="text-red-400 text-xs">{authError}</p>}
                    <button onClick={handleSignup} disabled={authLoading || !authEmail || !authPassword}
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {authLoading ? '...' : `📧 ${t('nav.signup')}`}
                    </button>
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px bg-gray-600"></div>
                      <span className="text-gray-500 text-xs">{t('nav.or')}</span>
                      <div className="flex-1 h-px bg-gray-600"></div>
                    </div>
                    <GoogleLogin />
                    <p className="text-gray-400 text-xs">
                      {t('nav.hasAccount')}{' '}
                      <button onClick={() => { setAuthMode('login'); resetAuthForm(); }} className="text-purple-400">{t('nav.login')}</button>
                    </p>
                  </>
                )}

                {authMode === 'forgot' && (
                  <>
                    <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="Email" className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm" />
                    {authError && <p className="text-red-400 text-xs">{authError}</p>}
                    <button onClick={handleForgotPassword} disabled={authLoading || !authEmail}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {authLoading ? '...' : `📧 ${t('nav.sendResetLink')}`}
                    </button>
                    <button onClick={() => { setAuthMode('login'); resetAuthForm(); }}
                      className="text-gray-400 hover:text-white text-xs">← {t('nav.backToLogin')}</button>
                  </>
                )}

                {authMode === 'reset' && (
                  <>
                    <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder={t('nav.newPassword')} className="w-full bg-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm" />
                    <p className="text-gray-500 text-xs">{t('nav.passwordHint')}</p>
                    {authError && <p className="text-red-400 text-xs">{authError}</p>}
                    <button onClick={handleResetPassword} disabled={authLoading || !authPassword}
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {authLoading ? '...' : `🔑 ${t('nav.resetPassword')}`}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
