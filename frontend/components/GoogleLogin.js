import { useEffect, useRef, useState } from 'react';
import { setSession } from '../utils/api';
import { useLanguage } from '../i18n/LanguageContext';

export default function GoogleLogin({ onSuccess }) {
  const { t } = useLanguage();
  const buttonDiv = useRef(null);
  // F12: surface GSI/script failures instead of rendering an empty box.
  const [gsiError, setGsiError] = useState('');

  useEffect(() => {
    const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!CLIENT_ID) {
      setGsiError(t('nav.googleNotConfigured'));
      return;
    }

    const init = () => {
      if (!window.google || !window.google.accounts || !buttonDiv.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.renderButton(
        buttonDiv.current,
        { theme: 'outline', size: 'large', text: 'signin_with', width: 220 }
      );
    };

    // F12: the modal remounts this component on every open — reuse the script
    // tag instead of piling a duplicate onto <body>.
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (existing.dataset.gsiLoaded === '1') init();
      else existing.addEventListener('load', init);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      script.dataset.gsiLoaded = '1';
      init();
    };
    script.onerror = () => setGsiError(t('nav.googleLoadFailed'));
    document.body.appendChild(script);
  }, []);

  const handleCredentialResponse = async (response) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.token, data.user);
        if (onSuccess) onSuccess(data.user);
        // Same ?next= contract as the email form in Navbar.
        const next = new URLSearchParams(window.location.search).get('next');
        if (next && next.startsWith('/') && !next.startsWith('//')) window.location.replace(next);
        else window.location.reload();
      } else {
        setGsiError(data.error || t('nav.googleFailed'));
      }
    } catch (err) {
      console.error('Google login failed:', err);
      setGsiError(t('nav.googleFailedTry'));
    }
  };

  // Error shows BESIDE the (possibly empty) button area so a retry is possible.
  return (
    <div>
      <div ref={buttonDiv} />
      {gsiError && <div className="text-xs text-red-500 mt-2" role="alert">{gsiError}</div>}
    </div>
  );
}
