import Document, { Html, Head, Main, NextScript } from 'next/document';

const BASE = (process.env.DASHBOARD_BASE_URL || '').replace(/\/+$/, '');

// Discord cuts long descriptions at roughly 350 characters, so these stay under that.
// Link previews are generated once by Discord's crawler and cached — they can't adapt to each
// viewer's language. So: English is the default (works for everyone), and an Arabic version is
// served when the link has ?lang=ar  →  https://<site>/?lang=ar
const PREVIEWS = {
  en: {
    locale: 'en_US',
    alternate: 'ar_AR',
    title: 'Crossover — Cross-server Discord games bot + dashboard',
    description:
      '🎮 Play against players from every server: Tic Tac Toe, Rock Paper Scissors, Trivia, Flags, Mafia and Musical Chairs.\n' +
      '🏆 Points, levels, achievements and leaderboards.\n' +
      '💬 Friends, live chat, and a shop for game skins.\n' +
      '⚙️ Manage the bot in your server — prefix, games room and language — no commands needed.',
  },
  ar: {
    locale: 'ar_AR',
    alternate: 'en_US',
    title: 'Crossover — بوت ألعاب ديسكورد بين السيرفرات + لوحة تحكم',
    description:
      '🎮 العب ضد لاعبين من كل السيرفرات: XO، حجر ورقة مقص، تريفيا، أعلام، مافيا وكراسي.\n' +
      '🏆 نقاط ومستويات وإنجازات وترتيب لأفضل اللاعبين.\n' +
      '💬 أصدقاء وشات مباشر، ومتجر لأشكال اللعب.\n' +
      '⚙️ تحكّم في البوت داخل سيرفرك: البادئة وغرفة الألعاب واللغة، من غير أوامر.',
  },
};

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    let lang = 'en';
    try {
      const url = new URL(ctx.req?.url || '/', 'http://localhost');
      if (url.searchParams.get('lang') === 'ar') lang = 'ar';
    } catch {
      // keep the English default
    }
    return { ...initialProps, previewLang: lang };
  }

  render() {
    const lang = this.props.previewLang === 'ar' ? 'ar' : 'en';
    const p = PREVIEWS[lang];
    const pageUrl = lang === 'ar' ? `${BASE}/?lang=ar` : BASE;

    return (
      <Html>
        <Head>
          <link rel="icon" href="/favicon-64.png" sizes="64x64" type="image/png" />
          <link rel="icon" href="/favicon-256.png" sizes="256x256" type="image/png" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          {/* Discord paints the embed's side stripe with theme-color, so it is the brand green. */}
          <meta name="theme-color" content="#22c55e" />

          {/* Link preview (Discord, WhatsApp, Telegram, X…). Discord shows title + description + a large image. */}
          <meta name="description" content={p.description} />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="Crossover" />
          <meta property="og:locale" content={p.locale} />
          <meta property="og:locale:alternate" content={p.alternate} />
          <meta property="og:title" content={p.title} />
          <meta property="og:description" content={p.description} />
          <meta property="og:image" content={`${BASE}/og-image.png`} />
          <meta property="og:image:type" content="image/png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:image:alt" content="Crossover — Discord gaming bot and dashboard" />
          <meta property="og:url" content={pageUrl} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={p.title} />
          <meta name="twitter:description" content={p.description} />
          <meta name="twitter:image" content={`${BASE}/og-image.png`} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
