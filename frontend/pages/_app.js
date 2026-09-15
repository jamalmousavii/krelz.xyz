import '../styles/globals.css';
import { LanguageProvider } from '../i18n/LanguageContext';
import ErrorBoundary from '../components/ErrorBoundary';

export default function App({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <Component {...pageProps} />
      </LanguageProvider>
    </ErrorBoundary>
  );
}
