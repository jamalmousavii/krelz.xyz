import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Profile() {
  const { lang } = useLanguage();
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      setUser(JSON.parse(saved));
      fetchBalance();
      fetchTasks();
    }
  }, []);

  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/token/balance', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setBalance(data);
    } catch (err) {}
  };

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/chat/history', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setTasks(data.tasks || []);
    } catch (err) {}
  };

  if (!user) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
        <div className="container mx-auto px-4 py-20 text-center text-white">
          <p className="text-xl">Please login first</p>
          <a href="/" className="mt-4 inline-block bg-purple-600 px-6 py-3 rounded-lg">Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head><title>Profile - Krelz Network</title></Head>
      <nav className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-bold text-white">🚀 Krelz Network</a>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a href="/" className="text-white hover:text-gray-300 text-sm">← Home</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-12 max-w-2xl">
        <div className="flex items-center gap-4 mb-6 md:mb-8">
          {user.avatar ? (
            <img src={user.avatar} alt="avatar" className="w-16 h-16 rounded-full border-2 border-white/30" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center text-white text-2xl font-bold">
              {(user.name || user.email || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">{user.name || 'User'}</h1>
            <p className="text-gray-400 text-sm">{user.email}</p>
            <span className="text-xs text-purple-300">{user.role}</span>
          </div>
        </div>

        {balance && (
          <div className="grid grid-cols-2 gap-3 mb-6 md:mb-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center">
              <div className="text-xl md:text-2xl font-bold text-green-400">{balance.available.toFixed(2)}</div>
              <div className="text-gray-300 text-xs">Available</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center">
              <div className="text-xl md:text-2xl font-bold text-blue-400">{balance.total_earned.toFixed(2)}</div>
              <div className="text-gray-300 text-xs">Earned</div>
            </div>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-5 md:p-6">
          <h2 className="text-lg font-bold text-white mb-4">Recent Tasks</h2>
          {tasks.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No tasks yet</p>
          ) : (
            <div className="space-y-2">
              {tasks.slice(0, 10).map((task, i) => (
                <div key={i} className="p-3 bg-black/30 rounded-lg text-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white truncate max-w-[70%]">{task.prompt}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      task.status === 'completed' ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'
                    }`}>{task.status}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{task.model}</span>
                    <span>{task.tokens_used || 0} tokens • {(task.cost || 0).toFixed(4)} KRELZ</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
