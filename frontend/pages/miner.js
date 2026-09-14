import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const CATEGORY_ICONS = {
  chat: '💬',
  code: '💻',
  vision: '👁️',
  embedding: '🔗',
};

export default function Miner() {
  const { t, lang } = useLanguage();
  const [copied, setCopied] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState(['qwen3.6:27b']);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (data.success) setModels(data.models);
    } catch (err) {
      console.error('Failed to load models');
    }
  };

  const toggleModel = (modelId) => {
    setSelectedModels(prev =>
      prev.includes(modelId)
        ? prev.filter(m => m !== modelId)
        : [...prev, modelId]
    );
  };

  const ubuntuCmd = 'wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-ubuntu.sh && bash install-ubuntu.sh';
  const redhatCmd = 'wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-redhat.sh && bash install-redhat.sh';

  const copyCommand = (cmd, id) => {
    navigator.clipboard.writeText(cmd);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const categories = [...new Set(models.map(m => m.category))];

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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white text-center mb-4">🖥️ {t('miner.heading')}</h1>
          <p className="text-center text-gray-300 mb-10 text-lg">{t('miner.installDesc')}</p>

          {/* Model Selection */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">🤖 {t('miner.selectModels')}</h2>
            <p className="text-gray-400 text-sm mb-6">{t('miner.selectModelsDesc')}</p>

            {categories.map(cat => (
              <div key={cat} className="mb-6">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <span>{CATEGORY_ICONS[cat]}</span>
                  <span>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {models.filter(m => m.category === cat).map(model => {
                    const isSelected = selectedModels.includes(model.id);
                    return (
                      <button
                        key={model.id}
                        onClick={() => toggleModel(model.id)}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'bg-purple-600/50 border-purple-400 ring-2 ring-purple-400'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-bold text-sm">{model.name}</span>
                          <span className="text-purple-300 text-xs">{model.size}</span>
                        </div>
                        <p className="text-gray-400 text-xs mb-2">{model.desc}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-xs">RAM: {model.ram}</span>
                          {isSelected && <span className="text-green-400 text-xs">✅ Selected</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="mt-4 p-3 bg-black/30 rounded-lg">
              <p className="text-gray-400 text-xs mb-2">{t('miner.selectedModels')}:</p>
              <code className="text-green-400 text-sm break-all">
                {selectedModels.length > 0 ? selectedModels.join(', ') : t('miner.noneSelected')}
              </code>
            </div>
          </div>

          {/* Install Boxes */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">⚡ {t('miner.quickInstall')}</h2>

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
                    copied === 'ubuntu' ? 'bg-green-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {copied === 'ubuntu' ? t('miner.copied') : t('miner.copyCmd')}
                </button>
              </div>
            </div>

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
                    copied === 'redhat' ? 'bg-green-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
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
