import { useEffect } from 'react';

export default function ChatRedirect() {
  useEffect(() => {
    window.location.href = '/';
  }, []);
  return null;
}
