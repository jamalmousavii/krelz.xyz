import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { isRtl } from '../i18n/translations';
import Navbar from '../components/Navbar';
import { useAuth, apiFetch } from '../utils/api';

export default function Admin() {
  const { lang } = useLanguage();
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [miners, setMiners] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState('dashboard');

  const { ready, user } = useAuth();
  const isAdmin = !!user && user.role === 'admin';
  const [denied, setDenied] = useState(false);

  const handle = (err) => {
    if (err && err.status === 403) setDenied(true);
  };

  const fetchDashboard = async () => {
    if (!isAdmin) return;
    try {
      const data = await apiFetch('/api/admin/dashboard');
      if (data.success) setDashboard(data.dashboard);
    } catch (err) { handle(err); }
  };

  const fetchUsers = async () => {
    try {
      const data = await apiFetch('/api/admin/users');
      if (data.success) setUsers(data.users);
    } catch (err) { handle(err); }
  };

  const fetchMiners = async () => {
    try {
      const data = await apiFetch('/api/admin/miners');
      if (data.success) setMiners(data.miners);
    } catch (err) { handle(err); }
  };

  const fetchTasks = async () => {
    try {
      const data = await apiFetch('/api/admin/tasks');
      if (data.success) setTasks(data.tasks);
    } catch (err) { handle(err); }
  };

  useEffect(() => { if (isAdmin) fetchDashboard(); }, [isAdmin]);

  const switchTab = (tb) => {
    if (!isAdmin) return;
    setTab(tb);
    if (tb === 'users') fetchUsers();
    else if (tb === 'miners') fetchMiners();
    else if (tb === 'tasks') fetchTasks();
    else fetchDashboard();
  };

  return (
    <div className={`flex-1 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 ${isRtl(lang) ? 'rtl' : 'ltr'}`}>
      <Head><title>Admin - Krelz Network</title></Head>
      <Navbar />

      <main className="container mx-auto px-4 md:px-6 py-6">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['dashboard', 'users', 'miners', 'tasks'].map(tb => (
            <button key={tb} onClick={() => switchTab(tb)}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${tab === tb ? 'bg-sky-500 text-white' : 'bg-white text-gray-600 border border-sky-200 hover:bg-sky-50'}`}>
              {tb.charAt(0).toUpperCase() + tb.slice(1)}
            </button>
          ))}
        </div>

        {!isAdmin && ready && (
          <div className="bg-white border border-red-100 shadow-sm rounded-xl p-8 text-center">
            <p className="text-gray-800 font-bold">Access denied</p>
            <p className="text-gray-500 text-sm mt-2">This area is restricted to administrators.</p>
          </div>
        )}

        {denied && isAdmin && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-600">
            You do not have permission to view this data.
          </div>
        )}

        {isAdmin && tab === 'dashboard' && dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-sky-100 shadow-sm rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{dashboard.miners.online}</div>
              <div className="text-gray-500 text-sm">Online Miners</div>
            </div>
            <div className="bg-white border border-sky-100 shadow-sm rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-800">{dashboard.miners.total}</div>
              <div className="text-gray-500 text-sm">Total Miners</div>
            </div>
            <div className="bg-white border border-sky-100 shadow-sm rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-sky-600">{dashboard.users}</div>
              <div className="text-gray-500 text-sm">Users</div>
            </div>
            <div className="bg-white border border-sky-100 shadow-sm rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-500">{Number(dashboard.revenue || 0).toFixed(2)}</div>
              <div className="text-gray-500 text-sm">Platform Fees (KRELZ)</div>
            </div>
          </div>
        )}

        {isAdmin && tab === 'users' && (
          <div className="bg-white border border-sky-100 shadow-sm rounded-xl overflow-x-auto">
            <table className="w-full text-gray-700 text-sm">
              <thead><tr className="border-b border-sky-100 bg-sky-50">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Joined</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-sky-50 hover:bg-sky-50/50">
                    <td className="px-4 py-2">#{u.id}</td>
                    <td className="px-4 py-2">{u.email}</td>
                    <td className="px-4 py-2">{u.name || '--'}</td>
                    <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs ${u.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-sky-100 text-sky-700'}`}>{u.role}</span></td>
                    <td className="px-4 py-2 text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isAdmin && tab === 'miners' && (
          <div className="grid md:grid-cols-2 gap-4">
            {miners.length === 0 && <p className="text-gray-400 text-center col-span-2 py-10">No miners</p>}
            {miners.map(m => (
              <div key={m.id} className="bg-white border border-sky-100 shadow-sm rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-800 font-bold">Miner #{m.id}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${m.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{m.status}</span>
                </div>
                <div className="text-gray-600 text-xs space-y-1">
                  <p>GPU: {m.gpu_model || 'Unknown'}</p>
                  <p>Tasks: {m.total_tasks} | Earned: {Number(m.earnings || 0).toFixed(2)} KRELZ</p>
                  <p className="font-mono text-gray-400">{m.wallet_address?.slice(0, 16)}...</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {isAdmin && tab === 'tasks' && (
          <div className="bg-white border border-sky-100 shadow-sm rounded-xl overflow-x-auto">
            <table className="w-full text-gray-700 text-sm">
              <thead><tr className="border-b border-sky-100 bg-sky-50">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Cost</th>
                <th className="px-4 py-3 text-left">Time</th>
              </tr></thead>
              <tbody>
                {tasks.map(tk => (
                  <tr key={tk.id} className="border-b border-sky-50 hover:bg-sky-50/50">
                    <td className="px-4 py-2">#{tk.id}</td>
                    <td className="px-4 py-2">{tk.user_email || '--'}</td>
                    <td className="px-4 py-2 text-xs">{tk.model}</td>
                    <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs ${tk.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : tk.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>{tk.status}</span></td>
                    <td className="px-4 py-2">{Number(tk.cost || 0).toFixed(4)}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">{tk.created_at ? new Date(tk.created_at).toLocaleDateString() : '--'}</td>
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
