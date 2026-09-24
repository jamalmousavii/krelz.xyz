import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { isRtl } from '../i18n/translations';
import Navbar from '../components/Navbar';

const CATEGORY_ICONS = { chat: '💬', code: '💻', vision: '👁️', embedding: '🔗' };

export default function Miner() {
  const { t, lang } = useLanguage();
  const [models, setModels] = useState([]);

  useEffect(() => { fetchModels(); }, []);

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (data.success) setModels(data.models);
    } catch (err) { console.error('Failed to load models'); }
  };

  const ubuntuCmd = 'wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-ubuntu.sh && bash install-ubuntu.sh';
  const redhatCmd = 'wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-redhat.sh && bash install-redhat.sh';
  const ubuntuUninstall = 'wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/uninstall-ubuntu.sh && bash uninstall-ubuntu.sh';
  const redhatUninstall = 'wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/uninstall-redhat.sh && bash uninstall-redhat.sh';

  const categories = [...new Set(models.map(m => m.category))];

  return (
    <div className={`flex-1 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 ${isRtl(lang) ? 'rtl' : 'ltr'}`}>
      <Head><title>{t('miner.title')}</title></Head>

      <Navbar />

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-12 pb-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-800 text-center mb-3 md:mb-4">🖥️ {t('miner.heading')}</h1>
          <p className="text-center text-gray-500 mb-6 md:mb-8 text-sm md:text-lg">{t('miner.installDocsDesc')}</p>

          <div className="flex flex-wrap gap-3 justify-center mb-8">
            <a href="https://github.com/jamalmousavii/krelz.xyz" target="_blank" rel="noopener noreferrer"
              className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition inline-flex items-center gap-2 min-h-[44px]">
              ⭐ {t('miner.github')}
            </a>
            <a href="https://github.com/jamalmousavii/krelz.xyz#readme" target="_blank" rel="noopener noreferrer"
              className="bg-white hover:bg-sky-50 text-gray-700 border border-sky-200 px-5 py-2.5 rounded-lg text-sm font-bold transition inline-flex items-center gap-2 min-h-[44px]">
              📖 {t('miner.viewGuide')}
            </a>
          </div>

          {/* Install (docs, no copy buttons) */}
          <div className="bg-white border border-sky-100 shadow-sm rounded-xl p-5 md:p-8 mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">⚡ {t('miner.installTitle')}</h2>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🐧</span>
                <span className="text-gray-800 font-bold text-sm md:text-base">{t('miner.ubuntu')}</span>
              </div>
              <div className="bg-sky-50 border border-sky-100 rounded-lg px-3 md:px-4 py-2 md:py-3 font-mono text-xs md:text-sm text-emerald-700 overflow-x-auto">
                <code>{ubuntuCmd}</code>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🎩</span>
                <span className="text-gray-800 font-bold text-sm md:text-base">{t('miner.redhat')}</span>
              </div>
              <div className="bg-sky-50 border border-sky-100 rounded-lg px-3 md:px-4 py-2 md:py-3 font-mono text-xs md:text-sm text-emerald-700 overflow-x-auto">
                <code>{redhatCmd}</code>
              </div>
            </div>
          </div>

          {/* Connect */}
          <div className="bg-white border border-sky-100 shadow-sm rounded-xl p-5 md:p-8 mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">🔗 {t('miner.connectTitle')}</h2>
            <ol className="text-gray-600 space-y-3 text-sm md:text-base">
              <li>{t('miner.connectStep1')}</li>
              <li>{t('miner.connectStep2')}</li>
              <li className="bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 font-mono text-xs text-emerald-700 overflow-x-auto">
                {ubuntuCmd} --token YOUR_TOKEN
              </li>
              <li>{t('miner.connectStep3')}</li>
              <li className="text-gray-400">{t('miner.connectStep4')}</li>
            </ol>
          </div>

          {/* Delete / Uninstall */}
          <div className="bg-white border border-sky-100 shadow-sm rounded-xl p-5 md:p-8 mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">🗑️ {t('miner.deleteTitle')}</h2>
            <p className="text-gray-600 text-sm md:text-base mb-4">{t('miner.deleteFromSite')}</p>
            <p className="text-gray-600 text-sm md:text-base mb-3">{t('miner.deleteFromServer')}</p>
            <div className="space-y-3">
              <div>
                <div className="text-gray-800 font-bold text-sm mb-1">🐧 {t('miner.uninstallUbuntu')}</div>
                <div className="bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 font-mono text-xs text-emerald-700 overflow-x-auto">
                  <code>{ubuntuUninstall}</code>
                </div>
              </div>
              <div>
                <div className="text-gray-800 font-bold text-sm mb-1">🎩 {t('miner.uninstallRedhat')}</div>
                <div className="bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 font-mono text-xs text-emerald-700 overflow-x-auto">
                  <code>{redhatUninstall}</code>
                </div>
              </div>
            </div>
          </div>

          {/* Model catalog */}
          <div className="bg-white border border-sky-100 shadow-sm rounded-xl p-5 md:p-8 mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">🤖 {t('miner.selectModels')}</h2>
            <p className="text-gray-500 text-xs md:text-sm mb-4 md:mb-6">{t('miner.selectModelsDesc')}</p>
            {categories.map(cat => (
              <div key={cat} className="mb-4 md:mb-6">
                <h3 className="text-gray-700 font-bold mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                  <span>{CATEGORY_ICONS[cat]}</span>
                  <span>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                  {models.filter(m => m.category === cat).map(model => (
                    <div key={model.id} className="text-left p-3 md:p-4 rounded-xl border-2 border-sky-100 bg-white">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-800 font-bold text-xs md:text-sm">{model.name}</span>
                        <span className="text-sky-600 text-xs">{model.size}</span>
                      </div>
                      <p className="text-gray-500 text-xs mb-2 hidden sm:block">{model.desc}</p>
                      <span className="text-gray-400 text-xs">RAM: {model.ram}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Requirements */}
          <div className="bg-white border border-sky-100 shadow-sm rounded-xl p-5 md:p-8 mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">{t('miner.requirements')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-sky-50 rounded-lg p-4 border border-sky-100">
                <h3 className="text-gray-800 font-bold mb-3 text-sm md:text-base">🧑‍💻 {t('miner.userSection')}</h3>
                <p className="text-gray-600 text-sm">{t('miner.userRequirements')}</p>
              </div>
              <div className="bg-sky-50 rounded-lg p-4 border border-sky-100">
                <h3 className="text-gray-800 font-bold mb-3 text-sm md:text-base">⛏️ {t('miner.minerSection')}</h3>
                <p className="text-gray-600 text-sm">{t('miner.minerRequirements')}</p>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-white border border-sky-100 shadow-sm rounded-xl p-5 md:p-8">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">{t('miner.howItWorks')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-gray-800 font-bold mb-3 text-sm md:text-base">🧑‍💻 {t('miner.userSection')}</h3>
                <ol className="text-gray-600 space-y-3 text-sm md:text-base">
                  {[1,2,3,4].map(n => (
                    <li key={n} className="flex items-start">
                      <span className="bg-sky-500 text-white rounded-full w-7 h-7 md:w-8 md:h-8 flex items-center justify-center mr-3 flex-shrink-0 text-sm">{n}</span>
                      <span>{t(`miner.userStep${n}`)}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="text-gray-800 font-bold mb-3 text-sm md:text-base">⛏️ {t('miner.minerSection')}</h3>
                <ol className="text-gray-600 space-y-3 text-sm md:text-base">
                  {[1,2,3,4].map(n => (
                    <li key={n} className="flex items-start">
                      <span className="bg-violet-500 text-white rounded-full w-7 h-7 md:w-8 md:h-8 flex items-center justify-center mr-3 flex-shrink-0 text-sm">{n}</span>
                      <span>{t(`miner.minerStep${n}`)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
