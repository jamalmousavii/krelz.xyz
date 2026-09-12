import { useLanguage } from '../i18n/LanguageContext';

export default function LanguageSwitcher() {
  const { lang, changeLang } = useLanguage();

  return (
    <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
      <button
        onClick={() => changeLang('en')}
        className={`px-3 py-1 rounded-md text-sm font-bold transition ${
          lang === 'en'
            ? 'bg-purple-600 text-white'
            : 'text-gray-300 hover:text-white'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => changeLang('fa')}
        className={`px-3 py-1 rounded-md text-sm font-bold transition ${
          lang === 'fa'
            ? 'bg-purple-600 text-white'
            : 'text-gray-300 hover:text-white'
        }`}
      >
        فا
      </button>
    </div>
  );
}
