import { useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { isRtl } from '../i18n/translations';
import PlansContent from './PlansContent';

// v3.30.0 — pricing modal opened by `#plans` (deep link or Navbar ⭐ Plans).
// Works in every homepage state, including an active chat where the inline
// section does not exist.
export default function PlansModal({
  open,
  onClose,
  catalog,
  planHint,
  purchaseError,
  bundleAmount,
  setBundleAmount,
  onBuyPlan,
  onBuyBundle,
}) {
  const { t, lang } = useLanguage();
  const rtl = isRtl(lang);

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-[70] flex items-center justify-center p-3 md:p-6 ${rtl ? 'rtl' : 'ltr'}`} role="dialog" aria-modal="true" aria-label={t('home.pricingTitle')}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-sky-100 w-full max-w-4xl max-h-[85vh] overflow-y-auto p-4 md:p-6">
        <button
          onClick={onClose}
          aria-label="Close"
          className={`absolute top-3 ${rtl ? 'left-3' : 'right-3'} w-8 h-8 rounded-full bg-sky-50 hover:bg-sky-100 text-gray-500 hover:text-gray-800 text-lg font-bold transition flex items-center justify-center`}
        >
          ✕
        </button>
        {catalog?.plans?.length > 0 ? (
          <PlansContent
            catalog={catalog}
            planHint={planHint}
            purchaseError={purchaseError}
            bundleAmount={bundleAmount}
            setBundleAmount={setBundleAmount}
            onBuyPlan={onBuyPlan}
            onBuyBundle={onBuyBundle}
          />
        ) : (
          <div className="text-center text-gray-500 py-10">Loading...</div>
        )}
      </div>
    </div>
  );
}
