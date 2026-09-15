import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

export default function Navbar() {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);
  const dropdownRef = useRef(null);

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

          {/* Profile Dropdown */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
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
            </div>
          ) : (
            <a href="/profile" className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition text-white text-sm">
              👤
            </a>
          )}
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
            <a href="/profile" className="text-gray-300 hover:text-white transition py-2">👤 {t('profile.dashboard')}</a>
            <a href="/profile#settings" className="text-gray-300 hover:text-white transition py-2">⚙️ {t('profile.settings')}</a>
            {user && (
              <button onClick={handleLogout} className="text-red-400 hover:text-red-300 transition py-2 text-left">
                🚪 {t('profile.logout')}
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
