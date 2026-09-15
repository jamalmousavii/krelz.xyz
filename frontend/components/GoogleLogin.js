import { useEffect, useRef } from 'react';

export default function GoogleLogin() {
  const buttonDiv = useRef(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (window.google && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });
        if (buttonDiv.current) {
          window.google.accounts.id.renderButton(
            buttonDiv.current,
            { theme: 'outline', size: 'large', text: 'signin_with', width: 220 }
          );
        }
      }
    };
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
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.reload();
      }
    } catch (err) {
      console.error('Google login failed:', err);
    }
  };

  return <div ref={buttonDiv} />;
}
