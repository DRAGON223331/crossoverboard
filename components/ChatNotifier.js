import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// One place that knows the unread-message total for the whole dashboard.
//
//  • polls /api/chat/unread (one Redis round trip) — the nav badge and the
//    tab title both read from here, so there is a single poller, not two
//  • puts the count in the tab title:  "(3) Crossover"
//  • optionally plays a soft tone when the total goes UP (off by default)
//
// The poll keeps running while the tab is in the background — that is the whole
// point of a title counter. Browsers slow background timers on their own, and
// each poll also refreshes the "online" flag; once a tab is throttled hard the
// flag expires and the friend's next message is delivered as a Discord DM instead.

const POLL_MS = 15000;
const SOUND_KEY = 'cx-chat-sound';

const UnreadContext = createContext({ unread: 0, refresh: () => {}, soundOn: false, setSoundOn: () => {} });

export function useUnread() {
  return useContext(UnreadContext);
}

let audioCtx = null;

/** Two short, quiet notes. Uses WebAudio, so there is no sound file to ship. */
function playPing() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t0 = now + i * 0.12;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.25);
    });
  } catch {
    // Audio blocked or unsupported — the title counter still works.
  }
}

function readSoundPref() {
  try {
    return window.localStorage.getItem(SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

export function UnreadProvider({ children }) {
  const [unread, setUnread] = useState(0);
  const [soundOn, setSoundState] = useState(false);
  const prevRef = useRef(null); // null until the first answer, so opening the site never beeps
  const soundRef = useRef(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    const on = readSoundPref();
    soundRef.current = on;
    setSoundState(on);
  }, []);

  const setSoundOn = useCallback((on) => {
    soundRef.current = on;
    setSoundState(on);
    try {
      window.localStorage.setItem(SOUND_KEY, on ? '1' : '0');
    } catch {
      // Private mode: the choice just lasts until reload.
    }
    if (on) playPing(); // clicking is the user gesture browsers require, and it doubles as a preview
  }, []);

  const load = useCallback(async () => {
    if (stoppedRef.current) return;
    try {
      const res = await fetch('/api/chat/unread', { cache: 'no-store' });
      if (res.status === 401) {
        // Not signed in (login page): nothing to count, stop asking.
        stoppedRef.current = true;
        setUnread(0);
        return;
      }
      if (!res.ok) return;
      const total = (await res.json()).unread || 0;
      if (prevRef.current !== null && total > prevRef.current && soundRef.current) playPing();
      prevRef.current = total;
      setUnread(total);
    } catch {
      // Network hiccup: keep the last known number.
    }
  }, []);

  useEffect(() => {
    let timer;
    const loop = async () => {
      await load();
      if (!stoppedRef.current) timer = window.setTimeout(loop, POLL_MS);
    };
    loop();
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // Tab title: "(3) Crossover". Pages can change the title later, so re-apply on any change.
  useEffect(() => {
    const label = unread > 99 ? '99+' : String(unread);
    const apply = () => {
      const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
      const next = unread > 0 ? `(${label}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    const titleEl = document.querySelector('title');
    if (!titleEl) return undefined;
    const observer = new MutationObserver(apply);
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [unread]);

  const value = useMemo(() => ({ unread, refresh: load, soundOn, setSoundOn }), [unread, load, soundOn, setSoundOn]);
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}
