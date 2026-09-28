import { Html, Head, Main, NextScript } from 'next/document';

const BASE = (process.env.DASHBOARD_BASE_URL || '').replace(/\/+$/, '');
const TITLE = 'Crossover — بوت ألعاب ديسكورد بين السيرفرات + لوحة تحكم';
// Discord cuts long descriptions at roughly 350 characters, so this stays under that.
const DESCRIPTION =
  '🎮 العب ضد لاعبين من كل السيرفرات: XO، حجر ورقة مقص، تريفيا، أعلام، مافيا وكراسي.\n' +
  '🏆 نقاط ومستويات وإنجازات وترتيب لأفضل اللاعبين.\n' +
  '💬 أصدقاء وشات مباشر، ومتجر لأشكال اللعب.\n' +
  '⚙️ تحكّم في البوت داخل سيرفرك: البادئة وغرفة الألعاب واللغة، من غير أوامر.';

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="icon" href="/favicon-64.png" sizes="64x64" type="image/png" />
        <link rel="icon" href="/favicon-256.png" sizes="256x256" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Discord paints the embed's side stripe with theme-color, so it is the brand green. */}
        <meta name="theme-color" content="#22c55e" />

        {/* Link preview (Discord, WhatsApp, Telegram, X…). Discord shows title + description + a large image. */}
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crossover" />
        <meta property="og:locale" content="ar_AR" />
        <meta property="og:locale:alternate" content="en_US" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content={`${BASE}/og-image.png`} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Crossover — Discord gaming bot and dashboard" />
        <meta property="og:url" content={BASE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={`${BASE}/og-image.png`} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
