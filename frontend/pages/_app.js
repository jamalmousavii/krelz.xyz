import '../styles/globals.css';
import { LanguageProvider } from '../i18n/LanguageContext';
import ErrorBoundary from '../components/ErrorBoundary';
import Footer from '../components/Footer';

export default function App({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <div className="min-h-screen flex flex-col">
          <Component {...pageProps} />
          <Footer />
        </div>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
