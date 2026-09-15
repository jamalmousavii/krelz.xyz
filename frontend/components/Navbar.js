import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import GoogleLogin from './GoogleLogin';

export default function Navbar({ wallet, connected, connectWallet }) {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

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
          <a href="/staking" className="text-gray-300 hover:text-white transition">🔒</a>
          <a href="/wallet" className="text-gray-300 hover:text-white transition">💰</a>
          <a href="/profile" className="text-gray-300 hover:text-white transition">👤</a>
          <button
            onClick={connectWallet}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition text-sm"
          >
            {connected ? `🟢 ${wallet.slice(0, 6)}...${wallet.slice(-4)}` : t('nav.connectWallet')}
          </button>
          <GoogleLogin />
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
            <a href="/staking" className="text-gray-300 hover:text-white transition py-2">🔒 Staking</a>
            <a href="/wallet" className="text-gray-300 hover:text-white transition py-2">💰 Wallet</a>
            <a href="/profile" className="text-gray-300 hover:text-white transition py-2">👤 Profile</a>
            <a href="/admin" className="text-gray-300 hover:text-white transition py-2">⚙️ Admin</a>
            <button onClick={connectWallet}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition text-sm text-left">
              {connected ? `🟢 ${wallet.slice(0, 6)}...${wallet.slice(-4)}` : t('nav.connectWallet')}
            </button>
            <GoogleLogin />
          </div>
        </div>
      )}
    </nav>
  );
}
