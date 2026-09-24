import en from './translations/en';
import fa from './translations/fa';
import ar from './translations/ar';
import he from './translations/he';
import ur from './translations/ur';
import fr from './translations/fr';
import de from './translations/de';
import es from './translations/es';
import pt from './translations/pt';
import it from './translations/it';
import nl from './translations/nl';
import ru from './translations/ru';
import uk from './translations/uk';
import pl from './translations/pl';
import tr from './translations/tr';
import zh from './translations/zh';
import zhTW from './translations/zh-TW';
import ja from './translations/ja';
import ko from './translations/ko';
import hi from './translations/hi';
import bn from './translations/bn';
import id from './translations/id';
import vi from './translations/vi';
import th from './translations/th';
import ms from './translations/ms';
import sv from './translations/sv';
import da from './translations/da';
import fi from './translations/fi';
import no from './translations/no';
import cs from './translations/cs';
import ro from './translations/ro';
import el from './translations/el';
import hu from './translations/hu';

const translations = {
  en, fa, ar, he, ur, fr, de, es, pt, it, nl, ru, uk, pl, tr,
  zh, 'zh-TW': zhTW, ja, ko, hi, bn, id, vi, th, ms, sv, da, fi, no, cs, ro, el, hu,
};

export const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧', rtl: false },
  { code: 'fa', name: 'فارسی', flag: '🇮🇷', rtl: true },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'he', name: 'עברית', flag: '🇮🇱', rtl: true },
  { code: 'ur', name: 'اردو', flag: '🇵🇰', rtl: true },
  { code: 'fr', name: 'Français', flag: '🇫🇷', rtl: false },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', rtl: false },
  { code: 'es', name: 'Español', flag: '🇪🇸', rtl: false },
  { code: 'pt', name: 'Português', flag: '🇵🇹', rtl: false },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', rtl: false },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱', rtl: false },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', rtl: false },
  { code: 'uk', name: 'Українська', flag: '🇺🇦', rtl: false },
  { code: 'pl', name: 'Polski', flag: '🇵🇱', rtl: false },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷', rtl: false },
  { code: 'zh', name: '中文', flag: '🇨🇳', rtl: false },
  { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼', rtl: false },
  { code: 'ja', name: '日本語', flag: '🇯🇵', rtl: false },
  { code: 'ko', name: '한국어', flag: '🇰🇷', rtl: false },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', rtl: false },
  { code: 'bn', name: 'বাংলা', flag: '🇧🇩', rtl: false },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩', rtl: false },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', rtl: false },
  { code: 'th', name: 'ไทย', flag: '🇹🇭', rtl: false },
  { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾', rtl: false },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪', rtl: false },
  { code: 'da', name: 'Dansk', flag: '🇩🇰', rtl: false },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮', rtl: false },
  { code: 'no', name: 'Norsk', flag: '🇳🇴', rtl: false },
  { code: 'cs', name: 'Čeština', flag: '🇨🇿', rtl: false },
  { code: 'ro', name: 'Română', flag: '🇷🇴', rtl: false },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷', rtl: false },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺', rtl: false },
];

export const RTL_LANGS = new Set(LANGUAGES.filter(l => l.rtl).map(l => l.code));

export function isRtl(code) {
  return RTL_LANGS.has(code);
}

export function detectLanguage() {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = sessionStorage.getItem('krelz-lang');
    if (saved && translations[saved]) return saved;
  } catch (e) {}
  const prefs = navigator.languages || [navigator.language || 'en'];
  for (const p of prefs) {
    const code = String(p).toLowerCase();
    if (code.startsWith('zh-tw') || code.startsWith('zh-hk') || code.startsWith('zh-hant')) {
      if (translations['zh-TW']) return 'zh-TW';
    }
    if (translations[code]) return code;
    const base = code.split('-')[0];
    if (base === 'nb' || base === 'nn' || base === 'no') return 'no';
    if (translations[base]) return base;
  }
  return 'en';
}

export default translations;
