import Head from 'next/head';
import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Miner() {
  const { t, lang } = useLanguage();
  const [copied, setCopied] = useState(null);

  const ubuntuCmd = 'wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-ubuntu.sh && bash install-ubuntu.sh';
  const redhatCmd = 'wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-redhat.sh && bash install-redhat.sh';

  const copyCommand = (cmd, id) => {
    navigator.clipboard.writeText(cmd);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head>
        <title>{t('miner.title')}</title>
      </Head>

      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-white">🚀 Krelz Network</a>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <a href="/" className="text-white hover:text-gray-300">{t('nav.back')}</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-white text-center mb-4">🖥️ {t('miner.heading')}</h1>
          <p className="text-center text-gray-300 mb-10 text-lg">{t('miner.installDesc')}</p>

          {/* Install Boxes */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">⚡ {t('miner.quickInstall')}</h2>

            {/* Ubuntu/Debian */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🐧</span>
                <span className="text-white font-bold">{t('miner.ubuntu')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/40 rounded-lg px-4 py-3 font-mono text-sm text-green-400 overflow-x-auto">
                  <code>{ubuntuCmd}</code>
                </div>
                <button
                  onClick={() => copyCommand(ubuntuCmd, 'ubuntu')}
                  className={`px-4 py-3 rounded-lg font-bold transition ${
                    copied === 'ubuntu'
                      ? 'bg-green-600 text-white'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {copied === 'ubuntu' ? t('miner.copied') : t('miner.copyCmd')}
                </button>
              </div>
            </div>

            {/* RedHat/Fedora */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🎩</span>
                <span className="text-white font-bold">{t('miner.redhat')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/40 rounded-lg px-4 py-3 font-mono text-sm text-green-400 overflow-x-auto">
                  <code>{redhatCmd}</code>
                </div>
                <button
                  onClick={() => copyCommand(redhatCmd, 'redhat')}
                  className={`px-4 py-3 rounded-lg font-bold transition ${
                    copied === 'redhat'
                      ? 'bg-green-600 text-white'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {copied === 'redhat' ? t('miner.copied') : t('miner.copyCmd')}
                </button>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">{t('miner.requirements')}</h2>
            <ul className="text-gray-300 space-y-2">
              <li>✅ {t('miner.gpu')}</li>
              <li>✅ {t('miner.ram')}</li>
              <li>✅ {t('miner.internet')}</li>
              <li>✅ {t('miner.wallet')}</li>
            </ul>
          </div>

          {/* How it Works */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">{t('miner.howItWorks')}</h2>
            <ol className="text-gray-300 space-y-4">
              <li className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">1</span>
                <span>{t('miner.step1')}</span>
              </li>
              <li className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">2</span>
                <span>{t('miner.step2')}</span>
              </li>
              <li className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">3</span>
                <span>{t('miner.step3')}</span>
              </li>
              <li className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">4</span>
                <span>{t('miner.step4')}</span>
              </li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
