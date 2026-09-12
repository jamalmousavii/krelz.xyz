import Head from 'next/head';

export default function Miner() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Head>
        <title>ماینر - Krelz Network</title>
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

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-white text-center mb-8">
            🖥️ ماینر شوید
          </h1>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              دانلود اپلیکیشن ماینر
            </h2>
            <p className="text-gray-300 mb-6">
              اپلیکیشن ماینر را دانلود و نصب کنید. فقط کافیست روی دکمه شروع کلیک کنید!
            </p>

            <div className="grid grid-cols-3 gap-4">
              <button className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition">
                🪟 ویندوز
              </button>
              <button className="bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg transition">
                🐧 لینوکس
              </button>
              <button className="bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg transition">
                🍎 مک
              </button>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              نیازمندی‌ها
            </h2>
            <ul className="text-gray-300 space-y-2">
              <li>✅ GPU (NVIDIA RTX 3060 یا بالاتر)</li>
              <li>✅ حداقل 8GB RAM</li>
              <li>✅ اتصال اینترنت پایدار</li>
              <li>✅ کیف پول MetaMask</li>
            </ul>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              نحوه کار
            </h2>
            <ol className="text-gray-300 space-y-4">
              <li className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">۱</span>
                <span>اپلیکیشن را دانلود و نصب کنید</span>
              </li>
              <li className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">۲</span>
                <span>کیف پول MetaMask را وصل کنید</span>
              </li>
              <li className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">۳</span>
                <span>روی دکمه Start Mining کلیک کنید</span>
              </li>
              <li className="flex items-start">
                <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">۴</span>
                <span>درآمد کسب کنید! 🎉</span>
              </li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
