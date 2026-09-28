import '../styles/globals.css';
import { LanguageProvider } from '../i18n/LanguageContext';
import ErrorBoundary from '../components/ErrorBoundary';
import Footer from '../components/Footer';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isChatHome = router.pathname === '/';

  return (
    <ErrorBoundary>
      <LanguageProvider>
        {/* Chat home is a fixed frame: exactly one viewport tall (dvh with a
            100vh fallback for older browsers) and overflow-hidden, so the page
            itself never scrolls — only the message list does. Other routes
            keep normal document scrolling.
            When a field is focused on phones, visualViewport (index.js) sets
            --app-vv-height/--app-vv-shift so the frame fits the space above
            the on-screen keyboard instead of being covered by it. */}
        <div
          className={`${isChatHome ? 'h-screen overflow-hidden' : 'min-h-screen'} flex flex-col`}
          style={isChatHome
            ? { height: 'var(--app-vv-height, 100dvh)', transform: 'translateY(var(--app-vv-shift, 0px))' }
            : undefined}
        >
          <Component {...pageProps} />
          <Footer />
        </div>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
