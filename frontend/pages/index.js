import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { isRtl } from '../i18n/translations';
import Navbar from '../components/Navbar';
import { audioBlobToWav16k } from '../lib/audio';

const CATEGORY_ICONS = { chat: '💬', code: '💻', vision: '👁️', embedding: '🔗' };
const MAX_RAW_BYTES = 1.5 * 1024 * 1024;   // pdf/text/audio budget (audio is WAVed after this check)
const IMAGE_MAX_EDGE = 1280;               // client-side image compression target
const TEXT_FILE_RE = /\.(txt|md|csv|json|js|jsx|ts|tsx|py|java|c|h|cpp|hpp|cs|go|rs|rb|php|sh|sql|yml|yaml|xml|html|css|log|ini|cfg|conf|toml)$/i;

// Downscale + JPEG-compress an image so a phone photo fits the ~1.5MB
// attachment budget before it ever leaves the browser.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      if (base64.length > 4000000) { reject(new Error('image-too-large')); return; }
      resolve({ mime: 'image/jpeg', data: base64 });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image-load-failed')); };
    img.src = url;
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('file-read-failed'));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const { t, lang } = useLanguage();
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('llama3.1:8b');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const instantScrollRef = useRef(false);

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [subject, setSubject] = useState('');
  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectInput, setSubjectInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);

  // v3.28.0 — Upgrade surfaces: the 402 wall (upgrade_wall message) and the
  // once-per-day upsell banner after a wallet-paid message. Both carry the
  // plan catalog ({plans, token_bundle}) from the backend.
  const [upgradeNotice, setUpgradeNotice] = useState(null); // { plans, token_bundle } | null
  const [purchaseError, setPurchaseError] = useState('');
  const [bundleAmount, setBundleAmount] = useState('5'); // whole dollars for the token bundle

  // Attachments & voice (v3.20.0): one pending attachment per message.
  const [attachment, setAttachment] = useState(null); // { type, name, mime, data }
  const [attachError, setAttachError] = useState('');
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recChunksRef = useRef([]);
  const recTimerRef = useRef(null);

  const hasStarted = chat.length > 0;

  // Capability gates — mirror backend models.js flags. Attach (📎) is off for
  // embedding models entirely; images additionally require a vision-capable
  // model and voice notes an audio-capable one (gemma4:12b).
  const selectedModelData = models.find(m => m.id === selectedModel);
  const attachFileAllowed = !!selectedModelData && selectedModelData.category !== 'embedding';
  const visionOk = !!(selectedModelData && selectedModelData.vision);
  const audioOk = !!(selectedModelData && selectedModelData.audio);

  useEffect(() => {
    fetchModels();
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      setIsLoggedIn(true);
      fetchSessions(savedToken);
    }
  }, []);

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const scrollToBottom = (instant = false) => {
    const el = messagesRef.current;
    if (!el) return;
    if (instant) {
      // After a paint (and a second frame for layout) so refreshed/loaded
      // sessions land on the latest message even before fonts settle.
      requestAnimationFrame(() => requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; }));
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  };

  // Always show the latest message: instantly on session load / refresh,
  // smoothly on every new message or typing indicator — even if the user
  // scrolled up while waiting for the reply.
  useEffect(() => {
    if (chat.length === 0) return;
    const instant = instantScrollRef.current;
    instantScrollRef.current = false;
    scrollToBottom(instant);
  }, [chat.length, loading]);

  // Window resize / orientation change re-fits the viewport frame — snap the
  // chat back to the newest message so the latest reply stays visible.
  useEffect(() => {
    const onViewportChange = () => scrollToBottom(true);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
    };
  }, []);

  // Mobile keyboard (v3.23.0): iOS overlays the keyboard on top of the layout
  // viewport — the 100dvh frame does NOT shrink, so the composer ends up under
  // the keyboard with no scrollable ancestor to reveal it. While a field is
  // focused, fit the frame to the *visual* viewport via CSS vars consumed by
  // _app.js; released as soon as focus leaves.
  useEffect(() => {
    const vv = window.visualViewport;
    const FIELDS = ['INPUT', 'TEXTAREA'];
    const apply = () => {
      const focused = document.activeElement && FIELDS.includes(document.activeElement.tagName);
      if (vv && focused) {
        document.documentElement.style.setProperty('--app-vv-height', `${vv.height}px`);
        document.documentElement.style.setProperty('--app-vv-shift', `${vv.offsetTop}px`);
        scrollToBottom(true);
      } else {
        document.documentElement.style.removeProperty('--app-vv-height');
        document.documentElement.style.removeProperty('--app-vv-shift');
      }
    };
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    document.addEventListener('focusin', apply);
    document.addEventListener('focusout', apply);
    return () => {
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      document.removeEventListener('focusin', apply);
      document.removeEventListener('focusout', apply);
      document.documentElement.style.removeProperty('--app-vv-height');
      document.documentElement.style.removeProperty('--app-vv-shift');
    };
  }, []);

  // Keep the input ready for the next message: refocus when a reply lands
  // or a session is loaded, but never steal focus from another field
  // (subject rename input, dropdown) — activeElement is only body when the
  // user is not typing anywhere. Never on touch: refocusing would pop the
  // keyboard open again after every reply.
  useEffect(() => {
    if (loading || dropdownOpen) return;
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return;
    const active = document.activeElement;
    if (!active || active === document.body) inputRef.current?.focus();
  }, [loading, hasStarted, dropdownOpen]);

  // Unmount cleanup for the recording auto-stop timer.
  useEffect(() => () => clearTimeout(recTimerRef.current), []);

  // Desktop-only initial focus: autoFocus on phones would open the on-screen
  // keyboard during first paint and squeeze the hero out of the fixed frame.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) inputRef.current?.focus();
  }, []);

  const authHeaders = (tkn) => ({
    'Content-Type': 'application/json',
    ...(tkn ? { Authorization: `Bearer ${tkn}` } : {})
  });

  // Plan/token purchase: one NowPayments invoice per purchase; activation or
  // pot credit happens in the IPN webhook. Hosted checkout opens in a new tab.
  const purchasePlan = async (tier) => {
    if (!token) return;
    setPurchaseError('');
    try {
      const res = await fetch(`/api/plans/${tier}/purchase`, {
        method: 'POST',
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (data.success && data.invoice?.url) {
        window.open(data.invoice.url, '_blank', 'noopener');
      } else {
        setPurchaseError(data.error || t('chat.errorResponse'));
      }
    } catch (err) {
      setPurchaseError(t('chat.errorConnection'));
    }
  };

  // Token bundle ($1 = 1M tokens, whole dollars, never expires).
  const purchaseTokens = async () => {
    if (!token) return;
    setPurchaseError('');
    const amount = parseInt(bundleAmount, 10);
    if (!(amount >= 1 && amount <= 500)) {
      setPurchaseError(t('chat.bundleRange'));
      return;
    }
    try {
      const res = await fetch('/api/plans/tokens/purchase', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ amount_usd: amount }),
      });
      const data = await res.json();
      if (data.success && data.invoice?.url) {
        window.open(data.invoice.url, '_blank', 'noopener');
      } else {
        setPurchaseError(data.error || t('chat.errorResponse'));
      }
    } catch (err) {
      setPurchaseError(t('chat.errorConnection'));
    }
  };

  const dismissUpgradeNotice = () => {
    try { localStorage.setItem('krelz_upg_notice', new Date().toISOString().slice(0, 10)); } catch (e) {}
    setUpgradeNotice(null);
  };

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (data.success) setModels(data.models);
    } catch (err) { console.error('Failed to load models'); }
  };

  const fetchSessions = async (tkn) => {
    try {
      const res = await fetch('/api/chat/sessions', { headers: authHeaders(tkn) });
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions);
        if (data.sessions.length > 0 && !activeSessionId) {
          loadSession(data.sessions[0].id, tkn);
        }
      }
    } catch (err) { console.error('Failed to load sessions'); }
  };

  const loadSession = async (sessionId, tkn) => {
    const useToken = tkn || token;
    if (!useToken) return;
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, { headers: authHeaders(useToken) });
      const data = await res.json();
      if (data.success) {
        setActiveSessionId(sessionId);
        setSubject(data.session.subject || 'New Chat');
        // Mobile drawer: picking a session closes the overlay so the chat is visible.
        setSidebarOpen(false);
        const msgs = [];
        data.messages.forEach(m => {
          if (m.content !== null && m.content !== undefined) {
            msgs.push({ role: m.role, content: m.content, media: m.media || null });
          }
        });
        instantScrollRef.current = true;
        setChat(msgs);
      }
    } catch (err) { console.error('Failed to load session'); }
  };

  const createNewSession = async () => {
    if (!token) {
      setActiveSessionId(null);
      setSubject('');
      setChat([]);
      return;
    }
    try {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ subject: 'New Chat', model: selectedModel })
      });
      const data = await res.json();
      if (data.success) {
        setSessions(prev => [data.session, ...prev]);
        setActiveSessionId(data.session.id);
        setSubject(data.session.subject);
        setChat([]);
      }
    } catch (err) { console.error('Failed to create session'); }
  };

  const deleteSession = async (sessionId) => {
    if (!token) return;
    try {
      await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: authHeaders(token)
      });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId);
        if (remaining.length > 0) {
          loadSession(remaining[0].id);
        } else {
          setActiveSessionId(null);
          setSubject('');
          setChat([]);
        }
      }
    } catch (err) { console.error('Failed to delete session'); }
  };

  const updateSubject = async () => {
    if (!token || !activeSessionId || !subjectInput.trim()) return;
    try {
      await fetch(`/api/chat/sessions/${activeSessionId}`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({ subject: subjectInput.trim() })
      });
      setSubject(subjectInput.trim());
      setEditingSubject(false);
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId ? { ...s, subject: subjectInput.trim() } : s
      ));
    } catch (err) { console.error('Failed to update subject'); }
  };

  const removeAttachment = () => {
    setAttachment(null);
    setAttachError('');
  };

  const onPickFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setAttachError('');
    try {
      if (file.type && file.type.startsWith('image/')) {
        const { mime, data } = await compressImage(file);
        setAttachment({ type: 'image', name: file.name || 'image.jpg', mime, data });
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') || TEXT_FILE_RE.test(file.name)) {
        if (file.size > MAX_RAW_BYTES) {
          setAttachError(t('chat.attachTooLarge'));
          return;
        }
        const data = await fileToBase64(file);
        setAttachment({ type: 'file', name: file.name, mime: file.type || 'text/plain', data });
      } else {
        setAttachError(t('chat.attachUnsupported'));
      }
    } catch (err) {
      setAttachError(err && err.message === 'image-too-large' ? t('chat.attachTooLarge') : t('chat.attachFailed'));
    }
  };

  const startRecording = async () => {
    if (!audioOk || recording) return;
    setAttachError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) recChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(tr => tr.stop());
        clearTimeout(recTimerRef.current);
        setRecording(false);
        const blob = new Blob(recChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        recChunksRef.current = [];
        try {
          const { base64, duration } = await audioBlobToWav16k(blob);
          if (duration > 60) { setAttachError(t('chat.voiceTooLong')); return; }
          setAttachment({ type: 'audio', name: 'voice.wav', mime: 'audio/wav', data: base64 });
        } catch (convErr) {
          const code = convErr && convErr.message;
          setAttachError(
            code === 'audio-too-long' ? t('chat.voiceTooLong')
            : code === 'audio-too-short' ? t('chat.voiceTooShort')
            : t('chat.voiceFailed')
          );
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      // Hard cap: stop at 60s (Ollama/backend budget for one voice note).
      recTimerRef.current = setTimeout(() => {
        if (mr.state === 'recording') mr.stop();
      }, 60000);
    } catch (err) {
      setAttachError(t('chat.micDenied'));
    }
  };

  const stopRecording = () => {
    clearTimeout(recTimerRef.current);
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'recording') mr.stop();
  };

  const sendMessage = async () => {
    if (loading) return;
    if (!message.trim() && !attachment) return;

    // Capability gates — never send an attachment the model cannot answer.
    if (attachment) {
      if (!attachFileAllowed) { setAttachError(t('chat.attachEmbedding')); return; }
      if (attachment.type === 'image' && !visionOk) { setAttachError(t('chat.needVisionModel')); return; }
      if (attachment.type === 'audio' && !audioOk) { setAttachError(t('chat.needAudioModel')); return; }
    }

    const userMessage = message;
    const sentAttachment = attachment;
    setMessage('');
    setAttachment(null);
    setAttachError('');
    setChat(prev => [...prev, {
      role: 'user',
      content: userMessage,
      media: sentAttachment ? { type: sentAttachment.type, name: sentAttachment.name, mime: sentAttachment.mime, data: sentAttachment.data } : null,
    }]);
    setLoading(true);
    inputRef.current?.focus();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          message: userMessage,
          model: selectedModel,
          session_id: activeSessionId,
          ...(sentAttachment ? { attachment: sentAttachment } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChat(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          source: data.source || null,
          miner_id: data.miner_id || null,
          payment_status: data.payment_status || null,
        }]);
        // Wallet-funded reply → suggest plans (once per UTC day, dismissible).
        if (data.notice === 'upgrade_recommended') {
          try {
            const today = new Date().toISOString().slice(0, 10);
            if (localStorage.getItem('krelz_upg_notice') !== today) {
              setUpgradeNotice({ plans: data.plans || [], token_bundle: data.token_bundle || null });
            }
          } catch (e) {}
        }
        if (data.session_id && !activeSessionId) {
          setActiveSessionId(data.session_id);
          fetchSessions(token);
        } else if (data.session_id && activeSessionId) {
          fetchSessions(token);
        }
      } else if (res.status === 402 && data.code === 'upgrade_required') {
        // v3.28.0 wall: no free allowance, no credit, empty pot, empty wallet.
        setChat(prev => [...prev, {
          role: 'assistant',
          content: t('chat.upgradeDesc'),
          upgrade_wall: {
            signed_in: !!data.signed_in,
            plans: data.plans || [],
            token_bundle: data.token_bundle || null,
            free: data.free,
          },
        }]);
      } else {
        setChat(prev => [...prev, { role: 'assistant', content: data.error || t('chat.errorResponse') }]);
      }
    } catch (err) {
      setChat(prev => [...prev, { role: 'assistant', content: t('chat.errorConnection') }]);
    }
    setLoading(false);
  };

  const ModelDropdown = ({ upward }) => (
    <div className="relative flex-1 md:flex-none md:w-auto min-w-0" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="w-full md:w-auto bg-white hover:bg-sky-50 text-gray-700 border border-sky-200 px-4 py-3 md:py-3.5 rounded-xl transition flex items-center gap-2 min-w-[180px] justify-between text-sm shadow-sm"
      >
        <span className="truncate font-medium">
          {selectedModelData ? `${CATEGORY_ICONS[selectedModelData.category]} ${selectedModelData.name}` : selectedModel}
        </span>
        <span className="text-gray-400 text-xs">▼</span>
      </button>
      {dropdownOpen && (
        <div className={`absolute ${upward ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 w-full md:w-72 bg-white border border-sky-200 rounded-xl shadow-xl overflow-hidden z-50 max-h-[min(300px,40dvh)] overflow-y-auto`}>
          {models.map((model) => {
            const isSelected = selectedModel === model.id;
            const hasMiners = model.miners_online > 0;
            const canSelect = hasMiners;
            return (
              <button
                key={model.id}
                onClick={() => { if (canSelect) { setSelectedModel(model.id); setDropdownOpen(false); } }}
                disabled={!canSelect}
                className={`w-full text-left px-4 py-3 flex items-center justify-between transition text-sm border-b border-sky-50 last:border-0 ${
                  isSelected ? 'bg-sky-100 text-sky-800' : canSelect ? 'hover:bg-sky-50 text-gray-700' : 'opacity-40 cursor-not-allowed text-gray-400'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span>{CATEGORY_ICONS[model.category]}</span>
                  <span className="truncate font-medium">{model.name}</span>
                  <span className="text-sky-600 text-xs">{model.size}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {hasMiners ? (
                    <span className="text-emerald-600 text-xs">✅ {model.miners_online}</span>
                  ) : (
                    <span className="text-red-400 text-xs">⚠️ 0</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // 📎 / 🎤 controls shared by both input bars (hero + active chat).
  const MediaButtons = () => (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.txt,.md,.csv,.json,application/pdf,text/*"
        className="hidden"
        onChange={onPickFile}
      />
      <button
        type="button"
        onClick={() => { if (attachFileAllowed) fileInputRef.current?.click(); }}
        disabled={!attachFileAllowed}
        title={attachFileAllowed ? t('chat.attach') : t('chat.attachEmbedding')}
        className="flex-shrink-0 w-10 h-10 md:h-12 rounded-xl border border-sky-200 bg-white text-base hover:bg-sky-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={t('chat.attach')}
      >📎</button>
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        disabled={!audioOk && !recording}
        title={audioOk ? (recording ? t('chat.voiceStop') : t('chat.voice')) : t('chat.needAudioModel')}
        className={`flex-shrink-0 w-10 h-10 md:h-12 rounded-xl border text-base transition disabled:opacity-40 disabled:cursor-not-allowed ${
          recording ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'border-sky-200 bg-white hover:bg-sky-50'
        }`}
        aria-label={recording ? t('chat.voiceStop') : t('chat.voice')}
      >{recording ? '⏹' : '🎙️'}</button>
    </div>
  );

  const pendingAttachmentChip = attachment && (
    <div className="flex items-center gap-2 bg-white border border-sky-200 rounded-full pl-2.5 pr-2 py-1.5 text-xs text-gray-700 shadow-sm max-w-full">
      {attachment.type === 'image' ? (
        <img src={`data:${attachment.mime || 'image/jpeg'};base64,${attachment.data}`} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
      ) : (
        <span>{attachment.type === 'audio' ? '🎙️' : '📄'}</span>
      )}
      <span className="truncate max-w-[160px]">{attachment.name}</span>
      <button
        type="button"
        onClick={removeAttachment}
        className="flex items-center justify-center w-9 h-9 -my-1.5 -mr-1.5 text-gray-400 hover:text-red-500 font-bold rounded-md active:bg-red-50"
        title={t('chat.removeAttachment')}
      >✕</button>
    </div>
  );

  const attachErrorLine = attachError ? (
    <div className="text-red-500 text-xs">⚠️ {attachError}</div>
  ) : null;

  // ===== EMPTY STATE: centered hero =====
  if (!hasStarted) {
    return (
      <div className={`flex-1 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex flex-col ${isRtl(lang) ? 'rtl' : 'ltr'}`}>
        <Head>
          <title>Krelz Network - Decentralized LLM Inference</title>
          <meta name="description" content="Decentralized LLM Inference Network. Chat with AI models." />
        </Head>

        <Navbar />

        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
          <div className="text-center mb-8 md:mb-10">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-3">🚀 Krelz Network</h1>
            <p className="text-lg md:text-xl text-gray-500">{t('home.subtitle')}</p>
          </div>

          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-sky-100 p-4 md:p-5">
            {(attachment || attachError) && (
              <div className="flex flex-col gap-1.5 mb-3 items-start">
                {pendingAttachmentChip}
                {attachErrorLine}
              </div>
            )}
            {/* Mobile: [model | 📎🎙] on one row, [input | send] on the next.
                md:contents dissolves the wrappers so desktop keeps the original
                single row (model, media, input, send). */}
            <div className="flex flex-col md:flex-row gap-2 md:gap-3">
              <div className="flex items-center gap-2 md:contents">
                <ModelDropdown upward={false} />
                <MediaButtons />
              </div>
              <div className="flex gap-2 md:contents">
                <input
                  ref={inputRef}
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={t('chat.placeholder')}
                  className="flex-1 min-w-0 bg-sky-50 text-gray-800 placeholder-gray-500 border border-sky-100 px-4 md:px-6 py-3 md:py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm md:text-base"
                />
                <button
                  onClick={sendMessage}
                  disabled={loading}
                  className="w-auto md:w-auto bg-sky-500 hover:bg-sky-600 text-white px-6 md:px-8 py-3 md:py-3.5 rounded-xl transition disabled:opacity-50 font-bold text-sm md:text-base shadow-sm flex-shrink-0"
                >
                  {loading ? '...' : t('chat.send')}
                </button>
              </div>
            </div>
          </div>

          <p className="text-gray-400 text-sm mt-6">{t('chat.startTyping')}</p>
        </main>
      </div>
    );
  }

  // ===== ACTIVE STATE: sidebar + messages + bottom input =====
  return (
    <div className={`flex-1 min-h-0 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex flex-col ${isRtl(lang) ? 'rtl' : 'ltr'}`}>
      <Head><title>{t('chat.title')}</title></Head>

      <Navbar />

      <main className="flex-1 container mx-auto px-2 md:px-6 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-6 max-w-6xl flex gap-0 md:gap-4 min-h-0">
        {/* Sidebar — history. On phones it is an overlay drawer (fixed, 85%
            wide + backdrop) so it never squashes the chat column to 0 width;
            from md up it is the normal in-flow column. */}
        {isLoggedIn && sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setSidebarOpen(false)} />
        )}
        {isLoggedIn && (
          <div className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex fixed md:static inset-y-0 left-0 md:inset-auto z-40 w-[85%] max-w-xs md:w-64 md:max-w-none flex-shrink-0 md:mb-0 flex-col min-h-0 pt-4 md:pt-0 px-2 md:px-0`}>
            <div className="bg-white rounded-xl border border-sky-100 shadow-sm p-3 h-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-700 font-bold text-sm">💬 {t('chat.history')}</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="md:hidden flex items-center justify-center text-gray-400 hover:text-gray-600 text-lg min-w-[40px] min-h-[40px] -mr-2 -mt-2"
                >✕</button>
              </div>
              <button
                onClick={createNewSession}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white px-4 py-2.5 rounded-lg transition font-medium text-sm mb-3"
              >
                + {t('chat.newChat')}
              </button>

              <div className="flex-1 overflow-y-auto space-y-1">
                {sessions.length === 0 ? (
                  <p className="text-gray-400 text-xs text-center py-4">{t('chat.noSessions')}</p>
                ) : (
                  sessions.map(session => (
                    <div
                      key={session.id}
                      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition text-sm ${
                        activeSessionId === session.id
                          ? 'bg-sky-100 text-sky-800 font-medium'
                          : 'text-gray-600 hover:bg-sky-50'
                      }`}
                      onClick={() => loadSession(session.id)}
                    >
                      <span className="flex-1 truncate">{session.subject || t('chat.untitled')}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                        className="flex items-center justify-center w-10 h-10 -my-2 flex-shrink-0 text-red-400 hover:text-red-500 text-sm rounded-md active:bg-red-50 md:hidden md:group-hover:flex group-focus-within:flex"
                        title={t('chat.deleteSession')}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Subject bar */}
          {isLoggedIn && activeSessionId && (
            <div className="bg-white border border-sky-100 rounded-t-xl px-4 py-2.5 flex items-center gap-2 mb-0 shadow-sm">
              {isLoggedIn && !sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="md:hidden flex items-center justify-center text-gray-400 hover:text-sky-600 min-w-[40px] min-h-[40px] -my-2 -ml-2 mr-1 text-lg">☰</button>
              )}
              {editingSubject ? (
                <input
                  type="text"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') updateSubject(); if (e.key === 'Escape') setEditingSubject(false); }}
                  onBlur={updateSubject}
                  autoFocus
                  className="flex-1 bg-sky-50 text-gray-800 border border-sky-200 px-3 py-1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                  placeholder={t('chat.subjectPlaceholder')}
                />
              ) : (
                <>
                  <span className="text-gray-700 text-sm font-medium truncate">{subject || t('chat.untitled')}</span>
                  <button
                    onClick={() => { setSubjectInput(subject); setEditingSubject(true); }}
                    className="flex items-center justify-center text-gray-400 hover:text-sky-600 text-sm transition min-w-[40px] min-h-[40px] -my-2"
                    title={t('chat.renameSession')}
                  >
                    ✏️
                  </button>
                </>
              )}
            </div>
          )}

          {/* Messages */}
          <div ref={messagesRef} className={`bg-white border border-sky-100 ${isLoggedIn && activeSessionId ? 'rounded-b-xl' : 'rounded-xl'} p-3 md:p-5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain mb-3 shadow-sm`}>
            {chat.map((msg, i) => (
              <div key={i} className={`mb-4 ${msg.role === 'user' ? (isRtl(lang) ? 'text-right' : 'text-left') : (isRtl(lang) ? 'text-left' : 'text-right')}`}>
                <div className={`inline-block max-w-[85%] md:max-w-[80%] p-3 md:p-4 rounded-2xl text-sm md:text-base ${
                  msg.role === 'user'
                    ? 'bg-sky-500 text-white'
                    : 'bg-sky-50 text-gray-800 border border-sky-100'
                }`}>
                  {msg.media && msg.media.type === 'image' && msg.media.data && (
                    <img
                      src={`data:${msg.media.mime || 'image/jpeg'};base64,${msg.media.data}`}
                      alt={msg.media.name || 'image'}
                      className="rounded-xl max-h-48 md:max-h-64 max-w-full mb-2"
                    />
                  )}
                  {msg.media && msg.media.type !== 'image' && (
                    <div className={`inline-flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 mb-1 ${
                      msg.role === 'user' ? 'bg-white/20 text-white' : 'bg-white border border-sky-100 text-gray-600'
                    }`}>
                      <span>{msg.media.type === 'audio' ? '🎙️' : '📄'}</span>
                      <span className="truncate max-w-[180px]">{msg.media.name}</span>
                    </div>
                  )}
                  {msg.upgrade_wall ? (
                    <div className="min-w-[240px] md:min-w-[340px]">
                      <div className="font-bold text-violet-800 mb-1">⭐ {t('chat.upgradeTitle')}</div>
                      <div className="text-gray-700 mb-2 whitespace-pre-wrap">{msg.content}</div>
                      {msg.upgrade_wall.free && (
                        <div className="text-xs text-gray-500 mb-2">
                          {t('chat.upgradeFree')
                            .replace('{used}', Number(msg.upgrade_wall.free.used || 0).toLocaleString('en-US'))
                            .replace('{limit}', Number(msg.upgrade_wall.free.limit || 0).toLocaleString('en-US'))}
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5 mb-3">
                        {(msg.upgrade_wall.plans || []).map(p => (
                          <div key={p.name} className="flex items-center justify-between gap-2 bg-white border border-violet-100 rounded-lg px-2.5 py-2">
                            <div className="min-w-0 text-xs">
                              <span className="font-bold text-gray-800">{p.label}</span>
                              <span className="text-gray-600">
                                {' — '}
                                {t('chat.planRow')
                                  .replace('{price}', `$${p.price}`)
                                  .replace('{tokens}', Number(p.daily_tokens).toLocaleString('en-US'))}
                              </span>
                              <div className="text-[10px] text-gray-400">
                                {t('chat.planValue').replace('{value}', `$${p.value_usd_day}`)}
                              </div>
                            </div>
                            {msg.upgrade_wall.signed_in && (
                              <button
                                onClick={() => purchasePlan(p.name)}
                                className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex-shrink-0"
                              >
                                ⬆ {p.label}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {msg.upgrade_wall.signed_in && msg.upgrade_wall.token_bundle && (
                        <div className="bg-white border border-sky-100 rounded-lg px-2.5 py-2 mb-2 flex items-center gap-2">
                          <div className="min-w-0 flex-1 text-xs text-gray-600">
                            🎟️ {t('chat.bundleDesc')
                              .replace('{rate}', Number(msg.upgrade_wall.token_bundle.tokens_per_usd || 1000000).toLocaleString('en-US'))}
                          </div>
                          <input
                            value={bundleAmount}
                            onChange={(e) => setBundleAmount(e.target.value.replace(/[^0-9]/g, ''))}
                            inputMode="numeric"
                            aria-label={t('chat.bundlePlaceholder')}
                            className="w-16 border border-sky-200 rounded-lg px-2 py-1.5 text-xs text-center"
                          />
                          <button
                            onClick={purchaseTokens}
                            className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex-shrink-0"
                          >
                            {t('chat.bundleBtn')}
                          </button>
                        </div>
                      )}
                      {!msg.upgrade_wall.signed_in && (
                        <div className="text-xs text-gray-600 bg-white border border-violet-100 rounded-lg px-3 py-2">
                          {t('chat.upgradeGuestHint')}
                        </div>
                      )}
                      {purchaseError && <div className="text-red-500 text-xs mt-2">{purchaseError}</div>}
                    </div>
                  ) : msg.content ? <div className="break-words whitespace-pre-wrap">{msg.content}</div> : null}
                </div>
                {msg.role === 'assistant' && (
                  <div className={`text-xs text-gray-400 mt-1 ${isRtl(lang) ? 'text-right' : 'text-left'}`}>
                    {msg.source === 'miner' && (
                      <span className="text-emerald-600">⛏️ {t('chat.viaMiner')}{msg.miner_id ? ` #${msg.miner_id}` : ''}</span>
                    )}
                    {msg.source === 'local' && (
                      <span>💻 {t('chat.viaLocal')}</span>
                    )}
                    {msg.payment_status === 'free_miner' && (
                      <span className="text-amber-600"> 🎁 {t('chat.freeMinerCredit')}</span>
                    )}
                    {msg.payment_status === 'tokens' && (
                      <span className="text-sky-600"> 🎟️ {t('chat.paidTokens')}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className={isRtl(lang) ? 'text-left' : 'text-right'}>
                <div className="inline-block bg-sky-50 text-gray-600 border border-sky-100 p-3 md:p-4 rounded-2xl text-sm md:text-base">{t('chat.typing')}</div>
              </div>
            )}
            <div />
          </div>

          {/* v3.28.0 — plan upsell after a wallet-paid message (once/day) */}
          {upgradeNotice && (
            <div className="flex items-center gap-2 mb-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 text-xs md:text-sm">
              <span className="flex-1">
                ⭐ {t('chat.upgradeNotice')}
                {' '}
                {upgradeNotice.plans?.[0] && (
                  t('chat.planRow')
                    .replace('{price}', `$${upgradeNotice.plans[0].price}`)
                    .replace('{tokens}', Number(upgradeNotice.plans[0].daily_tokens).toLocaleString('en-US'))
                )}
                {purchaseError && <span className="block text-red-500">{purchaseError}</span>}
              </span>
              {isLoggedIn && upgradeNotice.plans?.[0] && (
                <button
                  onClick={() => purchasePlan(upgradeNotice.plans[0].name)}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition flex-shrink-0"
                >
                  ⬆ {upgradeNotice.plans[0].label}
                </button>
              )}
              <button onClick={dismissUpgradeNotice} aria-label="dismiss" className="text-amber-500 hover:text-amber-700 px-1.5 font-bold flex-shrink-0">
                ✕
              </button>
            </div>
          )}
          {/* Input bar — pinned bottom */}
          {(attachment || attachError) && (
            <div className="flex flex-col gap-1.5 mb-2 items-start">
              {pendingAttachmentChip}
              {attachErrorLine}
            </div>
          )}
          {/* Mobile: two compact rows; md:contents restores the single desktop row. */}
          <div className="flex flex-col md:flex-row gap-2 md:gap-3">
            <div className="flex items-center gap-2 md:contents">
              <ModelDropdown upward={true} />
              <MediaButtons />
            </div>
            <div className="flex gap-2 md:contents">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={t('chat.placeholder')}
                className="flex-1 min-w-0 bg-white text-gray-800 placeholder-gray-500 border border-sky-200 px-4 md:px-6 py-3 md:py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm md:text-base shadow-sm"
              />
              <button
                onClick={sendMessage}
                disabled={loading}
                className="bg-sky-500 hover:bg-sky-600 text-white px-6 md:px-8 py-3 md:py-3.5 rounded-xl transition disabled:opacity-50 font-bold text-sm md:text-base shadow-sm flex-shrink-0"
              >
                {loading ? '...' : t('chat.send')}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
