import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { isRtl } from '../i18n/translations';
import Navbar from '../components/Navbar';
import authHeaders from '../utils/auth';

const MODELS_LIST = [
  { id: 'free-cloud-ai', name: 'Free Cloud AI', category: 'chat' },
  { id: 'llama3.3:70b', name: 'Llama 3.3', category: 'chat' },
  { id: 'deepseek-r1:70b', name: 'DeepSeek R1', category: 'chat' },
  { id: 'llama3.1:8b', name: 'Llama 3.1', category: 'chat' },
  { id: 'qwen3-coder:30b', name: 'Qwen 3 Coder', category: 'code' },
  { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder', category: 'code' },
  { id: 'qwen3-vl:8b', name: 'Qwen 3 VL', category: 'vision' },
  { id: 'gemma4:12b', name: 'Gemma 4', category: 'vision' },
];

const CATEGORY_ICONS = { chat: '💻', code: '💻', vision: '👁️', embedding: '🔗' };

function ResourceBar({ label, value, color }) {
  const safeValue = Math.min(Math.max(parseFloat(value) || 0, 0), 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 text-xs w-10">{label}</span>
      <div className="flex-1 h-2 bg-sky-100 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${safeValue}%` }} />
      </div>
      <span className="text-gray-600 text-xs w-10 text-right">{safeValue.toFixed(1)}%</span>
    </div>
  );
}

export default function Miners() {
  const { t, lang } = useLanguage();
  const [user, setUser] = useState(null);
  const [miners, setMiners] = useState([]);
  const [editingMinerId, setEditingMinerId] = useState(null);
  const [minerNameInput, setMinerNameInput] = useState('');
  const [minerMsg, setMinerMsg] = useState('');
  const [newMinerName, setNewMinerName] = useState('');
  const [newMinerToken, setNewMinerToken] = useState('');
  const [newMinerLoading, setNewMinerLoading] = useState(false);
  const [copiedMinerId, setCopiedMinerId] = useState(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideForAdd, setGuideForAdd] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [regenTokenId, setRegenTokenId] = useState(null);
  const [regenTokenVal, setRegenTokenVal] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedInstall, setCopiedInstall] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        fetchMiners();
        if (!localStorage.getItem('krelz-guide-seen')) {
          setGuideForAdd(false);
          setShowGuideModal(true);
        }
      } catch (e) {}
    }
    setLoading(false);
  }, []);

  const fetchMiners = async () => {
    try {
      const res = await fetch('/api/miners/mine', { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setMiners(data.miners || (data.miner ? [data.miner] : []));
    } catch (err) {}
  };

  const switchModel = async (modelId, minerId) => {
    try {
      const res = await fetch('/api/miners/mine/model', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ model: modelId, miner_id: minerId || undefined })
      });
      const data = await res.json();
      if (data.success) {
        const updatedId = minerId || data.miner?.id;
        setMiners(prev => prev.map(m => m.id === updatedId ? { ...m, current_model: modelId } : m));
      }
    } catch (err) {}
  };

  const renameMiner = async (minerId) => {
    if (!minerNameInput.trim()) return;
    try {
      const res = await fetch(`/api/miners/mine/${minerId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ name: minerNameInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setMiners(prev => prev.map(m => m.id === minerId ? { ...m, name: minerNameInput.trim() } : m));
        setEditingMinerId(null);
        setMinerNameInput('');
      } else {
        setMinerMsg(`❌ ${data.error}`);
      }
    } catch (err) { setMinerMsg('❌ Rename failed'); }
  };

  const deleteMiner = async (minerId, minerName) => {
    if (!window.confirm(t('profile.confirmRemoveMiner'))) return;
    try {
      const res = await fetch(`/api/miners/mine/${minerId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setMiners(prev => prev.filter(m => m.id !== minerId));
        setMinerMsg(`✅ ${minerName || ''} ${t('profile.minerRemoved')}`);
        fetchMiners();
      } else {
        setMinerMsg(`❌ ${data.error}`);
      }
    } catch (err) { setMinerMsg('❌ Remove failed'); }
  };

  const copyText = (text, minerId) => {
    navigator.clipboard.writeText(text);
    setCopiedMinerId(minerId);
    setTimeout(() => setCopiedMinerId(null), 2000);
  };

  const ubuntuInstallCmd = 'wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-ubuntu.sh && bash install-ubuntu.sh --token YOUR_TOKEN';
  const redhatInstallCmd = 'wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-redhat.sh && bash install-redhat.sh --token YOUR_TOKEN';

  const copyInstall = (cmd, id) => {
    navigator.clipboard.writeText(cmd);
    setCopiedInstall(id);
    setTimeout(() => setCopiedInstall(null), 2000);
  };

  const openAddMiner = () => {
    setGuideForAdd(true);
    setShowGuideModal(true);
  };

  const closeGuide = () => {
    setShowGuideModal(false);
    localStorage.setItem('krelz-guide-seen', '1');
    if (guideForAdd) {
      setShowAddForm(true);
      setGuideForAdd(false);
    }
  };

  const createMiner = async () => {
    setNewMinerLoading(true);
    try {
      const res = await fetch('/api/miners', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: newMinerName.trim() || undefined })
      });
      const data = await res.json();
      if (data.success) {
        setNewMinerToken(data.miner.miner_token);
        setNewMinerName('');
        setShowAddForm(false);
        fetchMiners();
      } else {
        setMinerMsg(`❌ ${data.error}`);
      }
    } catch (err) { setMinerMsg('❌ Create failed'); }
    setNewMinerLoading(false);
  };

  const regenerateToken = async (minerId) => {
    try {
      const res = await fetch(`/api/miners/mine/${minerId}/token`, {
        method: 'PUT',
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setRegenTokenId(minerId);
        setRegenTokenVal(data.miner.miner_token);
        setMinerMsg(`✅ ${t('profile.tokenRegenerated')}`);
        fetchMiners();
      } else {
        setMinerMsg(`❌ ${data.error}`);
      }
    } catch (err) { setMinerMsg('❌ Token regenerate failed'); }
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
      <Head><title>{t('profile.myMiners')} - Krelz Network</title></Head>

      {/* Guide modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-sky-200 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800">{t('profile.minerGuideTitle')}</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>{t('profile.minerGuideStep1')}</p>
              <p>{t('profile.minerGuideStep2')}</p>
              <code className="block text-xs text-emerald-700 bg-sky-50 border border-sky-100 px-2 py-1 rounded break-all">
                wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-ubuntu.sh && bash install-ubuntu.sh --token YOUR_TOKEN
              </code>
              <p>{t('profile.minerGuideStep3')}</p>
              <p className="text-gray-400">{t('profile.minerGuideStep4')}</p>
              <p>{t('profile.minerGuideStep5')}</p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={closeGuide} className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold">
                {guideForAdd ? t('profile.minerGuideContinue') : t('profile.minerGuideClose')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Navbar />

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-12 max-w-3xl">
        {/* Quick nav */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <a href="/profile" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-gray-600 border border-sky-200 hover:bg-sky-50">📊 {t('nav.dashboard')}</a>
          <a href="/miners" className="px-4 py-2 rounded-lg text-sm font-bold bg-sky-500 text-white">⛏️ {t('nav.miners')}</a>
          <a href="/settings" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-gray-600 border border-sky-200 hover:bg-sky-50">⚙️ {t('nav.settings')}</a>
        </div>

        {/* Quick Install with copy buttons */}
        <div className="bg-white rounded-xl border border-sky-100 shadow-sm p-5 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1">⚡ {t('miner.quickInstall')}</h2>
          <p className="text-gray-500 text-xs mb-4">{t('miner.connectStep2')}</p>
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span>🐧</span>
                <span className="text-gray-800 font-bold text-sm">{t('miner.ubuntu')}</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 font-mono text-xs text-emerald-700 overflow-x-auto">
                  <code>{ubuntuInstallCmd}</code>
                </div>
                <button
                  onClick={() => copyInstall(ubuntuInstallCmd, 'ubuntu')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition min-h-[40px] ${
                    copiedInstall === 'ubuntu' ? 'bg-emerald-500 text-white' : 'bg-sky-500 hover:bg-sky-600 text-white'
                  }`}
                >
                  {copiedInstall === 'ubuntu' ? t('miner.copied') : t('miner.copyCmd')}
                </button>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span>🎩</span>
                <span className="text-gray-800 font-bold text-sm">{t('miner.redhat')}</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 font-mono text-xs text-emerald-700 overflow-x-auto">
                  <code>{redhatInstallCmd}</code>
                </div>
                <button
                  onClick={() => copyInstall(redhatInstallCmd, 'redhat')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition min-h-[40px] ${
                    copiedInstall === 'redhat' ? 'bg-emerald-500 text-white' : 'bg-sky-500 hover:bg-sky-600 text-white'
                  }`}
                >
                  {copiedInstall === 'redhat' ? t('miner.copied') : t('miner.copyCmd')}
                </button>
              </div>
            </div>
          </div>
          <p className="text-gray-400 text-xs mt-3">
            <a href="/miner" className="text-sky-600 hover:text-sky-700">📖 {t('miner.installDocsDesc')}</a>
            {' · '}
            <a href="https://github.com/jamalmousavii/krelz.xyz" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:text-sky-700">⭐ {t('miner.github')}</a>
          </p>
        </div>

        <div className="bg-white rounded-xl border border-sky-100 shadow-sm p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">⛏️ {t('profile.minerSettings')} {miners.length > 0 && <span className="text-gray-400">({miners.length})</span>}</h2>
            <button onClick={openAddMiner}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
              + {t('profile.addMiner')}
            </button>
          </div>
          {minerMsg && <p className="text-xs text-gray-600 mb-2">{minerMsg}</p>}

          {miners.length > 0 ? (
            <div className="space-y-4">
              {miners.map((m) => (
                <div key={m.id} className="bg-sky-50 rounded-lg p-4 space-y-3 border border-sky-100">
                  <div className="flex items-center justify-between">
                    {editingMinerId === m.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input type="text" value={minerNameInput} onChange={(e) => setMinerNameInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') renameMiner(m.id); if (e.key === 'Escape') setEditingMinerId(null); }}
                          placeholder={t('profile.minerNamePlaceholder')}
                          className="flex-1 bg-white text-gray-800 border border-sky-200 px-2 py-1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                        <button onClick={() => renameMiner(m.id)} className="text-emerald-600 hover:text-emerald-700 text-sm">✓</button>
                        <button onClick={() => setEditingMinerId(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
                      </div>
                    ) : (
                      <>
                        <span className="text-gray-800 text-sm font-medium truncate">{m.name || `${t('profile.miner')} #${m.id}`}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => { setEditingMinerId(m.id); setMinerNameInput(m.name || ''); }}
                            className="text-gray-400 hover:text-sky-600 text-xs" title={t('profile.rename')}>✏️</button>
                          <button onClick={() => deleteMiner(m.id, m.name)}
                            className="text-red-400 hover:text-red-500 text-xs" title={t('profile.remove')}>🗑️</button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">{t('profile.minerStatus')}</span>
                    <span className={`text-sm font-medium ${m.status === 'online' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {m.status === 'online' ? `🟢 ${t('profile.online')}` : `🔴 ${t('profile.offline')}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">{t('profile.gpuModel')}</span><span className="text-gray-800">{m.gpu_model || 'N/A'}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">{t('profile.ram')}</span><span className="text-gray-800">{m.ram || 'N/A'}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">{t('profile.cpu')}</span><span className="text-gray-800">{m.cpu || 'N/A'}</span></div>

                  {(m.cpu_usage > 0 || m.ram_usage > 0 || m.gpu_usage > 0 || m.disk_usage > 0) && (
                    <div className="bg-white rounded-lg p-3 space-y-2 border border-sky-100">
                      <p className="text-gray-500 text-xs font-medium mb-2">📊 {t('profile.resourceUsage')}</p>
                      <ResourceBar label="CPU" value={m.cpu_usage} color="from-sky-400 to-cyan-400" />
                      <ResourceBar label="RAM" value={m.ram_usage} color="from-emerald-400 to-teal-400" />
                      {m.gpu_usage > 0 && (
                        <ResourceBar label="GPU" value={m.gpu_usage} color="from-violet-400 to-purple-400" />
                      )}
                      <ResourceBar label="Disk" value={m.disk_usage} color="from-amber-400 to-orange-400" />
                    </div>
                  )}
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-500">{t('profile.currentModel')}</span>
                    <select value={m.current_model || 'llama3.1:8b'} onChange={(e) => switchModel(e.target.value, m.id)}
                      className="bg-white text-gray-800 text-sm px-2 py-1 rounded border border-sky-200 focus:outline-none focus:ring-1 focus:ring-sky-400">
                      {MODELS_LIST.map(md => (<option key={md.id} value={md.id}>{CATEGORY_ICONS[md.category]} {md.name}</option>))}
                    </select>
                  </div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">{t('profile.uptime')}</span><span className="text-gray-800">{parseFloat(m.uptime || 0).toFixed(1)}%</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">{t('profile.totalTasks')}</span><span className="text-gray-800">{m.total_tasks || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">{t('profile.earnings')}</span><span className="text-emerald-600 font-medium">{parseFloat(m.earnings || 0).toFixed(4)}</span></div>

                  {m.miner_token ? (
                    <div className="flex items-center gap-2 pt-1">
                      <code className="flex-1 text-emerald-700 text-xs break-all bg-white border border-sky-100 px-2 py-1 rounded">{m.miner_token}</code>
                      <button onClick={() => copyText(m.miner_token, m.id)}
                        className={`px-3 py-1 rounded text-xs font-bold transition ${copiedMinerId === m.id ? 'bg-emerald-500 text-white' : 'bg-sky-500 hover:bg-sky-600 text-white'}`}>
                        {copiedMinerId === m.id ? '✓' : '📋'}
                      </button>
                    </div>
                  ) : regenTokenId === m.id && regenTokenVal ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-emerald-700 text-xs break-all bg-white border border-sky-100 px-2 py-1 rounded">{regenTokenVal}</code>
                        <button onClick={() => copyText(regenTokenVal, m.id)}
                          className={`px-3 py-1 rounded text-xs font-bold transition ${copiedMinerId === m.id ? 'bg-emerald-500 text-white' : 'bg-sky-500 hover:bg-sky-600 text-white'}`}>
                          {copiedMinerId === m.id ? '✓' : '📋'}
                        </button>
                      </div>
                      <code className="block text-gray-600 text-xs break-all bg-white border border-sky-100 px-2 py-1 rounded">wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-ubuntu.sh && bash install-ubuntu.sh --token {regenTokenVal}</code>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-gray-400 text-xs">🔒 {t('profile.tokenHidden')}</span>
                      <button onClick={() => regenerateToken(m.id)}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded text-xs font-bold transition">
                        🔄 {t('profile.generateNewToken')}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {showAddForm && (
                <div className="bg-white rounded-lg p-4 space-y-2 border border-emerald-200">
                  <p className="text-gray-800 text-sm font-medium">➕ {t('profile.addMiner')}</p>
                  <p className="text-gray-500 text-xs">{t('profile.addMinerDesc')}</p>
                  <div className="flex gap-2">
                    <input type="text" value={newMinerName} onChange={(e) => setNewMinerName(e.target.value)}
                      placeholder={t('profile.enterMinerName')}
                      className="flex-1 bg-sky-50 text-gray-800 placeholder-gray-400 border border-sky-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                    <button onClick={createMiner} disabled={newMinerLoading}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition text-sm font-bold disabled:opacity-50">
                      {newMinerLoading ? '...' : `+ ${t('profile.create')}`}
                    </button>
                  </div>
                  {newMinerToken && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-emerald-700 text-xs break-all bg-sky-50 border border-sky-100 px-2 py-1 rounded">{newMinerToken}</code>
                        <button onClick={() => copyText(newMinerToken, 'new')}
                          className={`px-3 py-1 rounded text-xs font-bold transition ${copiedMinerId === 'new' ? 'bg-emerald-500 text-white' : 'bg-sky-500 hover:bg-sky-600 text-white'}`}>
                          {copiedMinerId === 'new' ? '✓' : '📋'}
                        </button>
                      </div>
                      <code className="block text-gray-600 text-xs break-all bg-sky-50 border border-sky-100 px-2 py-1 rounded">wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-ubuntu.sh && bash install-ubuntu.sh --token {newMinerToken}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-500 text-sm">{t('profile.noMiner')}</p>
              <p className="text-gray-400 text-xs">{t('profile.addMinerDesc')}</p>
              {showAddForm && (
                <div className="bg-white rounded-lg p-4 space-y-2 border border-emerald-200">
                  <p className="text-gray-800 text-sm font-medium">➕ {t('profile.addMiner')}</p>
                  <div className="flex gap-2">
                    <input type="text" value={newMinerName} onChange={(e) => setNewMinerName(e.target.value)}
                      placeholder={t('profile.enterMinerName')}
                      className="flex-1 bg-sky-50 text-gray-800 placeholder-gray-400 border border-sky-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                    <button onClick={createMiner} disabled={newMinerLoading}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition text-sm font-bold disabled:opacity-50">
                      {newMinerLoading ? '...' : `+ ${t('profile.create')}`}
                    </button>
                  </div>
                  {newMinerToken && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-emerald-700 text-xs break-all bg-sky-50 border border-sky-100 px-2 py-1 rounded">{newMinerToken}</code>
                        <button onClick={() => copyText(newMinerToken, 'new')}
                          className={`px-3 py-1 rounded text-xs font-bold transition ${copiedMinerId === 'new' ? 'bg-emerald-500 text-white' : 'bg-sky-500 hover:bg-sky-600 text-white'}`}>
                          {copiedMinerId === 'new' ? '✓' : '📋'}
                        </button>
                      </div>
                      <code className="block text-gray-600 text-xs break-all bg-sky-50 border border-sky-100 px-2 py-1 rounded">wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-ubuntu.sh && bash install-ubuntu.sh --token {newMinerToken}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
