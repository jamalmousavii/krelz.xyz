import { useLanguage } from '../i18n/LanguageContext';

export default function LanguageSwitcher() {
  const { lang, changeLang } = useLanguage();

  return (
    <div className="flex items-center gap-1 bg-sky-100 rounded-lg p-1 border border-sky-200">
      <button
        onClick={() => changeLang('en')}
        className={`px-3 py-1 rounded-md text-sm font-bold transition ${
          lang === 'en'
            ? 'bg-sky-500 text-white'
            : 'text-gray-600 hover:text-sky-700'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => changeLang('fa')}
        className={`px-3 py-1 rounded-md text-sm font-bold transition ${
          lang === 'fa'
            ? 'bg-sky-500 text-white'
            : 'text-gray-600 hover:text-sky-700'
        }`}
      >
        فا
      </button>
    </div>
  );
}
