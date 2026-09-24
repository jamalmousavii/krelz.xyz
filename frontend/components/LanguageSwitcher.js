import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGES } from '../i18n/translations';

export default function LanguageSwitcher() {
  const { lang, changeLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-sky-100 hover:bg-sky-200 border border-sky-200 px-3 py-2 rounded-lg transition text-sm font-medium text-gray-700 min-h-[40px]"
        aria-label="Language"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.name}</span>
        <span className="text-gray-400 text-xs">▼</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 max-h-[360px] overflow-y-auto bg-white border border-sky-200 rounded-xl shadow-xl z-50 py-1">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => { changeLang(l.code); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition text-left min-h-[40px] ${
                lang === l.code ? 'bg-sky-50 text-sky-700 font-bold' : 'text-gray-700 hover:bg-sky-50'
              }`}
            >
              <span className="text-base leading-none w-5">{l.flag}</span>
              <span className="flex-1 truncate">{l.name}</span>
              {lang === l.code && <span className="text-sky-500 text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
