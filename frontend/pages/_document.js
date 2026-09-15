import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#1e1b4b" />
        <meta name="description" content="Krelz Network - Decentralized LLM Inference Network. Earn KRELZ tokens by sharing your GPU power for AI inference." />
        <meta name="keywords" content="decentralized AI, LLM inference, GPU mining, KRELZ, blockchain AI, earn crypto, open source AI" />
        <meta name="author" content="Krelz Network" />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://krelz.xyz/" />
        <meta property="og:title" content="Krelz Network - Decentralized LLM Inference" />
        <meta property="og:description" content="Earn KRELZ tokens by sharing your GPU power for AI inference. Join the decentralized AI revolution." />
        <meta property="og:image" content="https://krelz.xyz/og-image.png" />
        <meta property="og:site_name" content="Krelz Network" />
        <meta property="og:locale" content="en_US" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://krelz.xyz/" />
        <meta name="twitter:title" content="Krelz Network - Decentralized LLM Inference" />
        <meta name="twitter:description" content="Earn KRELZ tokens by sharing your GPU power for AI inference." />
        <meta name="twitter:image" content="https://krelz.xyz/og-image.png" />
        <link rel="canonical" href="https://krelz.xyz/" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Krelz Network",
              "url": "https://krelz.xyz",
              "description": "Decentralized LLM Inference Network. Earn KRELZ tokens by sharing your GPU power for AI inference.",
              "applicationCategory": "AIApplication",
              "operatingSystem": "Web",
              "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
              "creator": { "@type": "Organization", "name": "Krelz Network" }
            })
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
