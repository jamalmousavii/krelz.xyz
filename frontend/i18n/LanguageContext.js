import { createContext, useContext, useState, useEffect } from 'react';
import translations, { detectLanguage, isRtl } from './translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const detected = detectLanguage();
    setLang(detected);
    document.documentElement.dir = isRtl(detected) ? 'rtl' : 'ltr';
    document.documentElement.lang = detected;
  }, []);

  const changeLang = (newLang) => {
    if (!translations[newLang]) return;
    setLang(newLang);
    if (typeof window !== 'undefined') {
      try { sessionStorage.setItem('krelz-lang', newLang); } catch (e) {}
      document.documentElement.dir = isRtl(newLang) ? 'rtl' : 'ltr';
      document.documentElement.lang = newLang;
    }
  };

  const t = (key) => {
    const keys = key.split('.');
    let value = translations[lang];
    for (const k of keys) {
      value = value?.[k];
    }
    if (value === undefined && lang !== 'en') {
      value = translations.en;
      for (const k of keys) {
        value = value?.[k];
      }
    }
    return value !== undefined ? value : key;
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
