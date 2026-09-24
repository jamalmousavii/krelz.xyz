import { useLanguage } from '../i18n/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();
  const version = t('home.version');
  const sentence = t('footer.sentence').replace('{version}', version);

  return (
    <footer className="border-t border-sky-100 bg-white/70 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 md:px-6 py-4 text-center text-gray-400 text-xs leading-relaxed">
        <p>{sentence}</p>
      </div>
    </footer>
  );
}
