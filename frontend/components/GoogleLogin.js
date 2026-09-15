import { useEffect, useRef, useState } from 'react';

export default function GoogleLogin({ onSuccess }) {
  const buttonDiv = useRef(null);
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const saved = localStorage.getItem('user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {}
    }

    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      setLoaded(true);
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
        setUser(data.user);
        if (onSuccess) onSuccess(data.user);
      }
    } catch (err) {
      console.error('Google login failed:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    if (window.google && window.google.accounts) {
      window.google.accounts.id.disableAutoSelect();
    }
    window.location.reload();
  };

  // If logged in, show user info + logout
  if (user) {
    return (
      <div className="flex items-center gap-3">
        {user.avatar && (
          <img src={user.avatar} alt="avatar" className="w-8 h-8 rounded-full border-2 border-white/30" />
        )}
        <span className="text-white text-sm font-medium hidden sm:inline">{user.name || user.email}</span>
        <button
          onClick={handleLogout}
          className="bg-red-600/50 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition"
        >
          Logout
        </button>
      </div>
    );
  }

  // If not logged in, show Google button
  return <div ref={buttonDiv} />;
}
