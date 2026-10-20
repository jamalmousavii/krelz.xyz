import { useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { isRtl } from '../i18n/translations';
import Portal from './Portal';
import PlansContent from './PlansContent';

// v3.30.0 — pricing modal opened by `#plans` (deep link or Navbar ⭐ Plans).
// Works in every homepage state, including an active chat where the inline
// section does not exist.
// v3.42.1 — portaled to <body> (same stacking-context trap as the mobile
// menu), bottom-sheet on phones, focus trap + initial focus.
export default function PlansModal({
  open,
  onClose,
  catalog,
  planHint,
  purchaseError,
  purchaseBusy,
  bundleAmount,
  setBundleAmount,
  onBuyPlan,
  onBuyBundle,
}) {
  const { t, lang } = useLanguage();
  const rtl = isRtl(lang);
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      // Minimal focus trap: keep Tab cycling inside the panel.
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const list = [...focusables].filter((el) => !el.disabled);
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    // Initial focus on the close button (screen readers announce the dialog).
    const timer = setTimeout(() => { if (closeRef.current) closeRef.current.focus(); }, 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center md:p-6" role="dialog" aria-modal="true" aria-label={t('home.pricingTitle')}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        className="relative bg-white rounded-t-3xl md:rounded-2xl shadow-xl border border-sky-100 w-full max-w-4xl max-h-[92dvh] md:max-h-[85vh] overflow-y-auto overscroll-contain p-4 md:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label={t('home.pricingClose') || 'Close'}
          className={`absolute top-3 ${rtl ? 'left-3' : 'right-3'} w-11 h-11 rounded-full bg-sky-50 hover:bg-sky-100 text-gray-500 hover:text-gray-800 text-lg font-bold transition flex items-center justify-center`}
        >
          ✕
        </button>
        {catalog?.plans?.length > 0 ? (
          <PlansContent
            catalog={catalog}
            planHint={planHint}
            purchaseError={purchaseError}
            purchaseBusy={purchaseBusy}
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
    </Portal>
  );
}
