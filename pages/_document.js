import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="icon" href="/favicon-64.png" sizes="64x64" type="image/png" />
        <link rel="icon" href="/favicon-256.png" sizes="256x256" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0b0d12" />

        {/* Open Graph metadata used by Discord, Facebook, and other link previews. */}
        <meta
          name="description"
          content="Crossover هو لوحة تحكم متكاملة لبوت Discord لإدارة السيرفرات ومتابعة حالة البوت واستكشاف الأوامر وعرض ملفات اللاعبين وإحصائياتهم وإنجازاتهم وتقدمهم في الألعاب من مكان واحد."
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crossover" />
        <meta property="og:title" content="Crossover — Discord Gaming Dashboard" />
        <meta
          property="og:description"
          content="لوحة تحكم Crossover لإدارة البوت داخل سيرفرات Discord، ومتابعة حالة البوت، واستعراض الأوامر، وإدارة السيرفرات، وعرض ملفات اللاعبين وإحصائيات الفوز والخسارة والإنجازات والتقدم في الألعاب — كل ذلك من لوحة واحدة."
        />
        <meta
          property="og:image"
          content={`${process.env.DASHBOARD_BASE_URL || ''}/crossover-logo.png`}
        />
        <meta property="og:image:alt" content="Crossover logo" />
        <meta property="og:url" content={process.env.DASHBOARD_BASE_URL || ''} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Crossover — Discord Gaming Dashboard" />
        <meta
          name="twitter:description"
          content="لوحة تحكم ألعاب لـ Discord لإدارة السيرفرات وحالة البوت والأوامر والملفات الشخصية والإحصائيات والإنجازات وتقدم الألعاب."
        />
        <meta
          name="twitter:image"
          content={`${process.env.DASHBOARD_BASE_URL || ''}/crossover-logo.png`}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
