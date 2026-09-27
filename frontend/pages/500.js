import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../components/Navbar';

export default function ServerError() {
  return (
    <div className="flex-1 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50">
      <Head>
        <title>500 - Krelz Network</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Navbar />
      <main className="container mx-auto px-4 py-16 text-center">
        <p className="text-7xl font-black text-red-500">500</p>
        <h1 className="text-2xl font-bold text-gray-800 mt-4">Something went wrong</h1>
        <p className="text-gray-500 mt-2">Please try again in a moment.</p>
        <Link
          href="/"
          className="inline-block mt-6 px-6 py-3 rounded-xl bg-sky-500 text-white font-bold hover:bg-sky-600 transition"
        >
          ← Home
        </Link>
      </main>
    </div>
  );
}
