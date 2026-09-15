import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Admin() {
  const { lang } = useLanguage();
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [miners, setMiners] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState('dashboard');

  useEffect(() => { fetchDashboard(); }, []);

  const headers = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/admin/dashboard', { headers: headers() });
      const data = await res.json();
      if (data.success) setDashboard(data.dashboard);
    } catch (err) { console.error(err); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { headers: headers() });
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch (err) {}
  };

  const fetchMiners = async () => {
    try {
      const res = await fetch('/api/admin/miners', { headers: headers() });
      const data = await res.json();
      if (data.success) setMiners(data.miners);
    } catch (err) {}
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/admin/tasks', { headers: headers() });
      const data = await res.json();
      if (data.success) setTasks(data.tasks);
    } catch (err) {}
  };

  const switchTab = (t) => {
    setTab(t);
    if (t === 'users') fetchUsers();
    else if (t === 'miners') fetchMiners();
    else if (t === 'tasks') fetchTasks();
    else fetchDashboard();
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 ${lang === 'fa' ? 'rtl' : 'ltr'}`}>
      <Head><title>Admin - Krelz Network</title></Head>
      <nav className="container mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-xl md:text-2xl font-bold text-white">🚀 Krelz Admin</a>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a href="/" className="text-white hover:text-gray-300 text-sm">← Home</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 md:px-6 py-6">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['dashboard', 'users', 'miners', 'tasks'].map(t => (
            <button key={t} onClick={() => switchTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${tab === t ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{dashboard.miners.online}</div>
              <div className="text-gray-300 text-sm">Online Miners</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white">{dashboard.miners.total}</div>
              <div className="text-gray-300 text-sm">Total Miners</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{dashboard.users}</div>
              <div className="text-gray-300 text-sm">Users</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">{dashboard.revenue.toFixed(2)}</div>
              <div className="text-gray-300 text-sm">Platform Fees (KRELZ)</div>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="bg-white/10 rounded-xl overflow-x-auto">
            <table className="w-full text-white text-sm">
              <thead><tr className="border-b border-white/20">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Joined</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="px-4 py-2">#{u.id}</td>
                    <td className="px-4 py-2">{u.email}</td>
                    <td className="px-4 py-2">{u.name || '--'}</td>
                    <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs ${u.role === 'admin' ? 'bg-red-800 text-red-300' : 'bg-gray-800 text-gray-300'}`}>{u.role}</span></td>
                    <td className="px-4 py-2 text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'miners' && (
          <div className="grid md:grid-cols-2 gap-4">
            {miners.length === 0 && <p className="text-gray-400 text-center col-span-2 py-10">No miners</p>}
            {miners.map(m => (
              <div key={m.id} className="bg-white/10 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-bold">Miner #{m.id}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${m.status === 'online' ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'}`}>{m.status}</span>
                </div>
                <div className="text-gray-300 text-xs space-y-1">
                  <p>GPU: {m.gpu_model || 'Unknown'}</p>
                  <p>Tasks: {m.total_tasks} | Earned: {(m.earnings || 0).toFixed(2)} KRELZ</p>
                  <p className="font-mono text-gray-500">{m.wallet_address?.slice(0, 16)}...</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'tasks' && (
          <div className="bg-white/10 rounded-xl overflow-x-auto">
            <table className="w-full text-white text-sm">
              <thead><tr className="border-b border-white/20">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Cost</th>
                <th className="px-4 py-3 text-left">Time</th>
              </tr></thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="px-4 py-2">#{t.id}</td>
                    <td className="px-4 py-2">{t.user_email || '--'}</td>
                    <td className="px-4 py-2 text-xs">{t.model}</td>
                    <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs ${t.status === 'completed' ? 'bg-green-800 text-green-300' : t.status === 'failed' ? 'bg-red-800 text-red-300' : 'bg-yellow-800 text-yellow-300'}`}>{t.status}</span></td>
                    <td className="px-4 py-2">{(t.cost || 0).toFixed(4)}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
