import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="icon" href="/favicon-64.png" sizes="64x64" type="image/png" />
        <link rel="icon" href="/favicon-256.png" sizes="256x256" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0b0d12" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
