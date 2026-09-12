import Head from 'next/head';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Miner() {
  const { t, lang } = useLanguage();

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
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-white text-center mb-8">🖥️ {t('miner.heading')}</h1>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">{t('miner.download')}</h2>
            <p className="text-gray-300 mb-6">{t('miner.downloadDesc')}</p>
            <div className="grid grid-cols-3 gap-4">
              <a href="/downloads/krelz-miner.AppImage" download className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition text-center font-bold">
                🐧 {t('miner.linux')}
              </a>
              <button disabled className="bg-gray-600 text-gray-400 py-3 rounded-lg text-center cursor-not-allowed">
                🪟 {t('miner.windows')}
              </button>
              <button disabled className="bg-gray-600 text-gray-400 py-3 rounded-lg text-center cursor-not-allowed">
                🍎 {t('miner.mac')}
              </button>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">{t('miner.requirements')}</h2>
            <ul className="text-gray-300 space-y-2">
              <li>✅ {t('miner.gpu')}</li>
              <li>✅ {t('miner.ram')}</li>
              <li>✅ {t('miner.internet')}</li>
              <li>✅ {t('miner.wallet')}</li>
            </ul>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">{t('miner.howItWorks')}</h2>
            <ol className="text-gray-300 space-y-4">
              <li className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">1</span>
                <span>{t('miner.step1')}</span>
              </li>
              <li className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">2</span>
                <span>{t('miner.step2')}</span>
              </li>
              <li className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">3</span>
                <span>{t('miner.step3')}</span>
              </li>
              <li className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">4</span>
                <span>{t('miner.step4')}</span>
              </li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
