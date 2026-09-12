import { useState } from 'react';
import Head from 'next/head';

export default function Chat() {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message;
    setMessage('');
    setChat([...chat, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await res.json();

      if (data.success) {
        setChat((prev) => [
          ...prev,
          { role: 'assistant', content: data.response },
        ]);
      } else {
        setChat((prev) => [
          ...prev,
          { role: 'assistant', content: 'خطا در دریافت پاسخ' },
        ]);
      }
    } catch (err) {
      setChat((prev) => [
        ...prev,
        { role: 'assistant', content: 'خطا در اتصال به سرور' },
      ]);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Head>
        <title>چت با AI - Krelz Network</title>
      </Head>

      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-white">
            🚀 Krelz Network
          </a>
          <a href="/" className="text-white hover:text-gray-300">
            بازگشت
          </a>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-8 max-w-3xl">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 h-[500px] overflow-y-auto mb-4">
          {chat.length === 0 && (
            <div className="text-center text-gray-400 py-20">
              <p className="text-xl">سلام! چطور می‌توانم کمک کنم؟</p>
            </div>
          )}

          {chat.map((msg, i) => (
            <div
              key={i}
              className={`mb-4 ${
                msg.role === 'user' ? 'text-left' : 'text-right'
              }`}
            >
              <div
                className={`inline-block max-w-[80%] p-4 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-green-600 text-white'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="text-right">
              <div className="inline-block bg-gray-600 text-white p-4 rounded-2xl">
                در حال تایپ...
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="پیام خود را بنویسید..."
            className="flex-1 bg-white/10 text-white placeholder-gray-400 px-6 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl transition disabled:opacity-50"
          >
            ارسال
          </button>
        </div>
      </main>
    </div>
  );
}
