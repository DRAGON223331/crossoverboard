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
    viewCommands: 'View all commands',
    navHome: 'Home',
    navServers: 'Servers',
    navCommands: 'Commands',
    navProfile: 'Profile',
    commandsTitle: 'All bot commands',
    commandsLede:
      'Every command Crossover Bot understands, split into games and general commands. The default prefix is `!` — your server can set its own with `!setprefix` or from the settings tab.',
    commandsBackHome: '← Home',
    commandsGamesTitle: '🎮 Games',
    commandsGamesLede:
      'Type these inside the server\'s game room. Every game is 1v1 — whoever clicks Join first becomes your opponent, even from another server.',
    commandsGeneralTitle: '⚙️ General',
    commandsGeneralLede: 'Work from any text channel (unless the description says otherwise).',
    commandsAdminTitle: '🛠️ Server owner / admin only',
    commandsAdminLede: 'Only the server owner or members with admin permissions can use these.',
    commands: {
      games: [
        { cmd: 'xo', title: 'Tic Tac Toe', desc: 'Start a Tic Tac Toe challenge. Whoever joins first becomes your opponent.' },
        { cmd: 'connect4 / c4', title: 'Connect 4', desc: 'Drop discs into a column and be the first to line up 4 in a row — across, down, or diagonal.' },
        { cmd: 'rps', title: 'Rock Paper Scissors', desc: 'Start a Rock Paper Scissors challenge against a random opponent.' },
        { cmd: 'fast', title: 'Fastest Click', desc: 'Once both players say something in the thread, a word is revealed — race to type it first.' },
        { cmd: 'flag', title: 'Guess the Flag', desc: 'Once both players say something, a random country\'s flag is revealed — race to name it first.' },
        { cmd: 'trivia', title: 'Trivia', desc: 'Once both players say something, a general-knowledge question is revealed — race to answer it first.' },
        { cmd: 'word', title: 'Guess the Word', desc: 'A scrambled word with a hint is revealed — race to unscramble it first. Guesses only count in English.' },
        { cmd: 'math / mathrace', title: 'Math Race', desc: 'A math problem is revealed — race to type the correct answer. Digits work in English (1 2 3) or Arabic (١ ٢ ٣).' },
        { cmd: 'mafia', title: 'Mafia', desc: '4–20 players. Killer(s) eliminate someone each night, the doctor can save one person, everyone else votes by day to find the killers.' },
        { cmd: 'chairs / charis', title: 'Musical Chairs', desc: '3–20 players. Every round has one fewer chair than players — click an empty one before time runs out. Last one sitting wins.' },
      ],
      general: [
        { cmd: 'help', title: 'Help menu', desc: 'Shows the in-Discord help menu with all commands.' },
        { cmd: 'daily [answer]', title: 'Daily question', desc: 'One shared trivia question a day, the same for everyone. `!daily` shows it, `!daily <answer>` answers it. Builds a day streak and earns points.' },
        { cmd: 'profile [@user] / rank', title: 'Profile', desc: 'Your points, win/loss record, current and best win streak, and a breakdown per game. Mention someone to see theirs.' },
        { cmd: 'history / hist', title: 'Match history', desc: 'Your last 10 matches — the opponent, the result and the points each one was worth.' },
        { cmd: 'top / leaderboard', title: 'Leaderboard', desc: 'This server\'s leaderboard. Use `!top global` for the all-servers board.' },
        { cmd: 'store / shop', title: 'Store', desc: 'Spend your points on skins and titles from a dropdown menu. Use 🎁 Send Gift to buy one for a friend.' },
        { cmd: 'inventory / inv', title: 'Inventory', desc: 'Opens the same panel as `!usettings` — everything you own.' },
        { cmd: 'usettings / mysettings', title: 'Personal settings', desc: 'Switch between the classic ❌⭕ and your bought skins, and pick the title shown under your name (or none).' },
        { cmd: 'play @friend <game>', title: 'Private challenge', desc: 'Challenge a specific friend directly (e.g. `!play @friend xo`) instead of broadcasting to the whole room — only they can join.' },
        { cmd: 'friend @user / addfriend', title: 'Send friend request', desc: 'Sends a real friend request with Accept/Decline buttons.' },
        { cmd: 'friends / friendlist', title: 'Friends list', desc: 'Lists everyone on your friends list.' },
        { cmd: 'unfriend @user', title: 'Remove friend', desc: 'Removes someone from your friends list.' },
        { cmd: 'mention', title: 'Page your opponent', desc: 'Use inside a game thread — pings your opponent there and in their own thread, and DMs them a link back.' },
        { cmd: 'add', title: 'Share your username', desc: 'Use inside a game thread — DMs your opponent your username so they can add you.' },
        { cmd: 'report [reason]', title: 'Report a player', desc: 'Use inside a game thread — privately DMs you and the bot owner the last messages, your opponent\'s name and server. They are never told.' },
        { cmd: 'block / unblock / blocked', title: 'Block list', desc: '`!block` (in a thread, or `!block @user` anywhere) stops you from ever being matched with them again. `!unblock <@user>` reverses it. `!blocked` DMs your list.' },
        { cmd: 'stop', title: 'Cancel challenge', desc: 'Cancels your own open challenge if no one has joined it yet.' },
        { cmd: 'invite', title: 'Invite link', desc: 'Get the link to add this bot to another server.' },
        { cmd: 'support', title: 'Support server', desc: 'Get the link to the support server.' },
        { cmd: 'dashboard', title: 'Dashboard link', desc: 'Get the link to this web dashboard.' },
        { cmd: 'ping', title: 'Latency check', desc: 'Check that the bot is alive and see its current message/API latency.' },
      ],
      admin: [
        { cmd: 'settings', title: 'Settings panel', desc: 'One panel for language, game room, prefix and the online (cross-server) play toggle.' },
        { cmd: 'setlang', title: 'Bot language', desc: 'Switch the bot\'s language (🇪🇬/🇺🇸) for this server.' },
        { cmd: 'setprefix <new prefix>', title: 'Change prefix', desc: 'Change this server\'s command prefix (max 5 characters).' },
        { cmd: 'chname <new name>', title: 'Rename game room', desc: 'Renames this server\'s dedicated game room.' },
        { cmd: 'chset <#channel>', title: 'Point to a channel', desc: 'Points the bot at an existing text channel as the game room, without renaming it.' },
        { cmd: 'chcreate', title: 'Recreate game room', desc: 'Recreates the game room if it was deleted.' },
      ],
    },
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
    viewCommands: 'شوف كل أوامر البوت',
    navHome: 'الرئيسية',
    navServers: 'السيرفرات',
    navCommands: 'الأوامر',
    navProfile: 'البروفايل',
    commandsTitle: 'كل أوامر البوت',
    commandsLede:
      'كل أمر البوت فاهمه، متقسم لألعاب وأوامر عامة. البادئة الافتراضية هي `!` — سيرفرك يقدر يغيّرها بأمر `!setprefix` أو من تاب الإعدادات.',
    commandsBackHome: '← الرئيسية',
    commandsGamesTitle: '🎮 الألعاب',
    commandsGamesLede:
      'اكتب الأوامر دي جوه روم اللعب بتاع السيرفر. كل لعبة 1v1 — أول واحد يضغط Join بيبقى خصمك، حتى لو من سيرفر تاني.',
    commandsGeneralTitle: '⚙️ الأوامر العامة',
    commandsGeneralLede: 'تشتغل من أي روم نصي (إلا لو الشرح قال غير كده).',
    commandsAdminTitle: '🛠️ لمالك السيرفر / الأدمن بس',
    commandsAdminLede: 'الأوامر دي مقصورة على مالك السيرفر أو الأعضاء اللي معاهم صلاحية أدمن.',
    commands: {
      games: [
        { cmd: 'xo', title: 'إكس أو (Tic Tac Toe)', desc: 'يبدأ تحدي إكس أو. أول حد يضغط Join بيبقى خصمك.' },
        { cmd: 'connect4 / c4', title: 'كونكت فور', desc: 'نزّل القطع في عمود وحاول تكون أول واحد يعمل 4 في صف — أفقي أو رأسي أو مايل.' },
        { cmd: 'rps', title: 'حجر ورقة مقص', desc: 'يبدأ تحدي حجر ورقة مقص ضد خصم عشوائي.' },
        { cmd: 'fast', title: 'أسرع ضغطة', desc: 'لما اللاعبين الاتنين يكتبوا حاجة في الثريد، بتظهر كلمة — سابقهم يكتبها الأول.' },
        { cmd: 'flag', title: 'خمن العلم', desc: 'لما اللاعبين يكتبوا حاجة، بيظهر علم دولة عشوائية — سابقهم تعرفها الأول.' },
        { cmd: 'trivia', title: 'تريفيا (أسئلة عامة)', desc: 'بيظهر سؤال معلومات عامة — سابقهم تجاوب الأول.' },
        { cmd: 'word', title: 'خمن الكلمة', desc: 'بتظهر كلمة متقلبة الحروف مع تلميح — فك التشفير الأول. الإجابة لازم تبقى إنجليزي.' },
        { cmd: 'math / mathrace', title: 'سباق الرياضيات', desc: 'بتظهر مسألة حسابية — سابقهم تحل الأول. الأرقام تشتغل إنجليزي (1 2 3) أو عربي (١ ٢ ٣).' },
        { cmd: 'mafia', title: 'مافيا', desc: 'من 4 لـ 20 لاعب. القاتل (أو أكتر) بيصفّي حد كل ليلة، الدكتور يقدر ينقذ واحد، والباقي بيصوّتوا بالنهار عشان يلاقوا القتلة.' },
        { cmd: 'chairs / charis', title: 'الكراسي الموسيقية', desc: 'من 3 لـ 20 لاعب. كل جولة كرسي أقل من عدد اللاعبين — اضغط على كرسي فاضي قبل ما الوقت يخلص. آخر واحد قاعد يكسب.' },
      ],
      general: [
        { cmd: 'help', title: 'قايمة المساعدة', desc: 'بيظهر قايمة المساعدة جوه ديسكورد بكل الأوامر.' },
        { cmd: 'daily [الإجابة]', title: 'سؤال اليوم', desc: 'سؤال تريفيا مشترك كل يوم، نفسه للجميع. `!daily` يعرضه، `!daily <الإجابة>` يجاوب عليه. بيبني سلسلة أيام (streak) ويدّيك نقاط.' },
        { cmd: 'profile [@user] / rank', title: 'البروفايل', desc: 'نقاطك وسجل الفوز/الخسارة، أطول سلسلة انتصارات حالية وأقصى واحدة، وتفصيل لكل لعبة. اعمل منشن لحد تاني عشان تشوف بروفايله.' },
        { cmd: 'history / hist', title: 'سجل المباريات', desc: 'آخر 10 مباريات ليك — الخصم والنتيجة والنقاط اللي كل مباراة كانت بتساوي كام.' },
        { cmd: 'top / leaderboard', title: 'لوحة الصدارة', desc: 'لوحة صدارة السيرفر ده. استخدم `!top global` عشان تشوف لوحة كل السيرفرات.' },
        { cmd: 'store / shop', title: 'المتجر', desc: 'اصرف نقاطك على skins وألقاب من قايمة منسدلة. استخدم 🎁 Send Gift عشان تشتري لصاحبك.' },
        { cmd: 'inventory / inv', title: 'المخزون', desc: 'بيفتح نفس البانل بتاع `!usettings` — كل حاجة إنت مالكها.' },
        { cmd: 'usettings / mysettings', title: 'إعداداتك الشخصية', desc: 'بدّل بين الشكل الكلاسيكي ❌⭕ والـ skins اللي اشتريتها، واختار اللقب اللي يظهر تحت اسمك (أو من غير لقب).' },
        { cmd: 'play @friend <لعبة>', title: 'تحدي خاص', desc: 'تحدى صاحبك مباشرة (مثلاً `!play @friend xo`) بدل ما تبعت تحدي عام للروم كله — هو بس اللي يقدر ينضم.' },
        { cmd: 'friend @user / addfriend', title: 'إرسال طلب صداقة', desc: 'بيبعت طلب صداقة حقيقي بأزرار قبول/رفض.' },
        { cmd: 'friends / friendlist', title: 'قايمة الأصدقاء', desc: 'بيعرض كل اللي في قايمة أصدقائك.' },
        { cmd: 'unfriend @user', title: 'شيل صديق', desc: 'يشيل حد من قايمة أصدقائك.' },
        { cmd: 'mention', title: 'نبّه خصمك', desc: 'استخدمه جوه ثريد اللعبة — بينادي على خصمك هناك وفي الثريد بتاعه هو، وكمان يبعتله DM فيه لينك يرجعه للثريد.' },
        { cmd: 'add', title: 'ابعت اليوزر نيم بتاعك', desc: 'استخدمه جوه ثريد اللعبة — بيبعت لخصمك DM باليوزر نيم بتاعك عشان يضيفك.' },
        { cmd: 'report [السبب]', title: 'إبلاغ عن لاعب', desc: 'استخدمه جوه ثريد اللعبة — بيبعتلك ولمالك البوت DM خاص فيه آخر رسايل، اسم خصمك وسيرفره. الطرف التاني ميعرفش خالص.' },
        { cmd: 'block / unblock / blocked', title: 'قايمة الحظر', desc: '`!block` (جوه ثريد، أو `!block @user` في أي مكان) بيمنع إن اللاعب ده يتقابل معاك تاني. `!unblock <@user>` بيرجعها. `!blocked` بيبعتلك القايمة في DM.' },
        { cmd: 'stop', title: 'إلغاء التحدي', desc: 'يلغي التحدي المفتوح بتاعك لو محدش انضم له لسه.' },
        { cmd: 'invite', title: 'لينك الإضافة', desc: 'يديك لينك إضافة البوت لسيرفر تاني.' },
        { cmd: 'support', title: 'سيرفر الدعم', desc: 'يديك لينك سيرفر الدعم.' },
        { cmd: 'dashboard', title: 'لينك لوحة التحكم', desc: 'يديك لينك لوحة التحكم دي.' },
        { cmd: 'ping', title: 'فحص الاستجابة', desc: 'يتأكد إن البوت شغال ويعرض سرعة استجابته الحالية.' },
      ],
      admin: [
        { cmd: 'settings', title: 'بانل الإعدادات', desc: 'بانل واحد للغة، روم اللعب، البادئة، وزرار اللعب بين السيرفرات.' },
        { cmd: 'setlang', title: 'لغة البوت', desc: 'يغيّر لغة البوت (🇪🇬/🇺🇸) لهذا السيرفر بس.' },
        { cmd: 'setprefix <البادئة الجديدة>', title: 'تغيير البادئة', desc: 'يغيّر بادئة أوامر السيرفر ده (أقصى حد 5 حروف).' },
        { cmd: 'chname <اسم جديد>', title: 'إعادة تسمية روم اللعب', desc: 'يغيّر اسم روم اللعب الخاص بالسيرفر.' },
        { cmd: 'chset <#روم>', title: 'تحديد روم موجود', desc: 'يوجّه البوت لروم نصي موجود بالفعل كروم لعب، من غير ما يغيّر اسمه.' },
        { cmd: 'chcreate', title: 'إعادة إنشاء روم اللعب', desc: 'يعيد إنشاء روم اللعب لو اتمسح.' },
      ],
    },
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
