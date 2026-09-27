import { createContext, useContext, useEffect, useState } from 'react';

export const translations = {
  en: {
    dir: 'ltr',
    code: 'en',
    brandSuffix: 'Dashboard',
    signIn: 'Sign in with Discord',
    signOut: 'Sign out',
    heroKicker: 'Discord bot control panel',
    heroTitle: 'Run your servers without typing commands.',
    heroLede:
      'Sign in with the Discord account that manages your server, and change the prefix, the game room, the language and cross-server play from a form instead of `!settings`.',
    errors: {
      invalid_state: 'That login link expired — try again.',
      login_failed: 'Discord could not verify that login — try again.',
      access_denied: 'Login was cancelled.',
      generic: 'Something went wrong logging in.',
    },
    yourServers: 'Your servers',
    yourServersLede: 'Servers where you can manage settings and the bot is already a member.',
    ownerBlocklistLink: '🔒 Owner: view block list',
    couldNotLoad: "Couldn't load your servers:",
    noServersFoundPre:
      "No matching servers found. Either you don't manage any server the bot is in, or the bot hasn't been invited yet — use",
    noServersFoundPost: 'in Discord to add it.',
    manage: 'Manage',
    allServers: 'All servers',
    changesLive: "Changes here go straight to the bot's database — no restart needed.",
    gamesToday: 'Games today',
    last7Days: 'Last 7 days',
    leaderboard: 'Leaderboard',
    noScores: 'No one has scored here yet.',
    rankedTotal: (total, shown) => `${total} ranked players total — showing the top ${shown}.`,
    commandPrefix: 'Command prefix',
    prefixExample: (p) => `Example: ${p}help`,
    language: 'Bot language',
    english: 'English',
    arabic: 'العربية',
    gameRoomChannel: 'Game room channel',
    unchanged: '— unchanged —',
    channelHint: "Points the bot at an existing text channel — it won't create one from here.",
    renameTo: 'Rename that channel to',
    crossServerPlay: 'Cross-server play',
    crossServerHint: "Lets this server's players match with other servers.",
    saveChanges: 'Save changes',
    saving: 'Saving…',
    savedOk: 'Saved. The bot picks this up within 10 seconds.',
    saveFailed: 'Save failed.',
    blocklistTitle: 'Block list',
    blocklistLede:
      "Every personal block currently in effect, across every server — read-only. A block isn't tied to any one server, so this lives here instead of on a server's own settings page.",
    noBlocks: 'No one has blocked anyone yet.',
    blocked: 'blocked',
    blocksTotal: (total, shown) => `${total} blocks total — showing the most recent ${shown}.`,
    tabManage: 'Manage settings',
    tabLeaderboard: 'Leaderboard & stats',
    profileTitle: 'Your profile',
    profileLede: 'Your Discord account, connected to this dashboard.',
    accountId: 'Discord user ID',
    accountRole: 'Role',
    roleOwner: 'Bot owner',
    roleMember: 'Server manager',
    manageableServers: 'Servers you can manage',
    viewProfile: 'Profile',
    goToServers: 'Go to your servers',
    manageServersTitle: 'Manage your servers',
  },
  ar: {
    dir: 'rtl',
    code: 'ar',
    brandSuffix: 'لوحة التحكم',
    signIn: 'تسجيل الدخول عبر ديسكورد',
    signOut: 'تسجيل الخروج',
    heroKicker: 'لوحة تحكم بوت ديسكورد',
    heroTitle: 'تحكّم في سيرفراتك من غير ما تكتب أوامر.',
    heroLede:
      'سجّل الدخول بحساب ديسكورد اللي بيدير السيرفر، وغيّر البادئة، وروم اللعب، واللغة، واللعب بين السيرفرات من فورم بسيط بدل ما تكتب `!settings`.',
    errors: {
      invalid_state: 'رابط الدخول انتهت صلاحيته — جرّب تاني.',
      login_failed: 'ديسكورد ما قدرش يتأكد من الدخول — جرّب تاني.',
      access_denied: 'تم إلغاء تسجيل الدخول.',
      generic: 'حصل خطأ أثناء تسجيل الدخول.',
    },
    yourServers: 'سيرفراتك',
    yourServersLede: 'السيرفرات اللي تقدر تدير إعداداتها والبوت عضو فيها بالفعل.',
    ownerBlocklistLink: '🔒 المالك: عرض قائمة الحظر',
    couldNotLoad: 'ما قدرناش نجيب سيرفراتك:',
    noServersFoundPre:
      'مفيش سيرفرات مطابقة. يا إما إنت مش مدير أي سيرفر فيه البوت، يا إما البوت لسه ما اتضافش — استخدم',
    noServersFoundPost: 'في ديسكورد عشان تضيفه.',
    manage: 'إدارة',
    allServers: 'كل السيرفرات',
    changesLive: 'أي تغيير هنا بيروح على طول لقاعدة بيانات البوت — من غير ما تعمل ريستارت.',
    gamesToday: 'مباريات النهاردة',
    last7Days: 'آخر 7 أيام',
    leaderboard: 'لوحة الصدارة',
    noScores: 'لسه محدش سجّل نقاط هنا.',
    rankedTotal: (total, shown) => `إجمالي ${total} لاعب مصنّف — بنعرض أفضل ${shown}.`,
    commandPrefix: 'بادئة الأوامر',
    prefixExample: (p) => `مثال: ${p}help`,
    language: 'لغة البوت',
    english: 'English',
    arabic: 'العربية',
    gameRoomChannel: 'روم اللعب',
    unchanged: '— بدون تغيير —',
    channelHint: 'بيوجّه البوت لروم نصي موجود بالفعل — مش هيعمل روم جديد من هنا.',
    renameTo: 'إعادة تسمية الروم إلى',
    crossServerPlay: 'اللعب بين السيرفرات',
    crossServerHint: 'يسمح للاعبين في السيرفر ده يلعبوا مع سيرفرات تانية.',
    saveChanges: 'حفظ التغييرات',
    saving: 'جاري الحفظ…',
    savedOk: 'تم الحفظ. البوت هياخد التحديث خلال 10 ثواني.',
    saveFailed: 'فشل الحفظ.',
    blocklistTitle: 'قائمة الحظر',
    blocklistLede:
      'كل عمليات الحظر الشخصية الفعّالة حاليًا، عبر كل السيرفرات — للعرض فقط. الحظر مش مرتبط بسيرفر معيّن، فلذلك موجود هنا بدل صفحة إعدادات كل سيرفر.',
    noBlocks: 'محدش حظر حد لحد دلوقتي.',
    blocked: 'حظر',
    blocksTotal: (total, shown) => `إجمالي ${total} عملية حظر — بنعرض آخر ${shown}.`,
    tabManage: 'إدارة الإعدادات',
    tabLeaderboard: 'لوحة الصدارة والإحصائيات',
    profileTitle: 'بروفايلك',
    profileLede: 'حساب ديسكورد بتاعك، متوصّل بلوحة التحكم دي.',
    accountId: 'آيدي المستخدم في ديسكورد',
    accountRole: 'الصلاحية',
    roleOwner: 'مالك البوت',
    roleMember: 'مدير سيرفر',
    manageableServers: 'السيرفرات اللي تقدر تديرها',
    viewProfile: 'البروفايل',
    goToServers: 'روح لسيرفراتك',
    manageServersTitle: 'إدارة سيرفراتك',
  },
};

const LanguageContext = createContext({
  lang: 'en',
  dir: 'ltr',
  t: translations.en,
  setLang: () => {},
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('cx-lang');
      if (saved && translations[saved]) setLangState(saved);
    } catch (e) {
      /* localStorage unavailable — stick with default */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = translations[lang].dir;
  }, [lang]);

  function setLang(next) {
    if (!translations[next]) return;
    setLangState(next);
    try {
      window.localStorage.setItem('cx-lang', next);
    } catch (e) {
      /* ignore */
    }
  }

  return (
    <LanguageContext.Provider
      value={{ lang, dir: translations[lang].dir, t: translations[lang], setLang, ready }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
