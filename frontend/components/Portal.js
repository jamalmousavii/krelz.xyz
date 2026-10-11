import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// v3.42.1 — fixed overlays (mobile menu, plans modal) must escape the chat
// home's transformed frame: any CSS transform (even translateY(0)) creates a
// stacking context that traps `position: fixed` descendants and lets the
// overflow-hidden ancestor clip them. Portaling to document.body keeps them
// truly viewport-fixed. SSR-safe: renders nothing until mounted.
export default function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
