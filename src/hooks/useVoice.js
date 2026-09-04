import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Yoga voice guidance via the Web Speech API.
 *
 * Devices ship wildly different Chinese voices, so pick deliberately rather
 * than taking whatever getVoices() lists first: zh-TW over other Chinese
 * locales, and the enhanced/neural builds over the compact ones, which sound
 * robotic enough to be distracting during a long hold.
 */
function voiceScore(v) {
  const label = `${v.name || ''} ${v.voiceURI || ''}`;
  let score = 0;
  if (/zh[-_]TW/i.test(v.lang)) score += 100;
  else if (/zh[-_](HK|CN)/i.test(v.lang)) score += 60;
  else if (/^zh/i.test(v.lang)) score += 40;
  if (/enhanced|premium|neural|natural|加強|優質/i.test(label)) score += 50;
  if (/siri/i.test(label)) score += 40;
  if (/美佳|mei-?jia/i.test(label)) score += 20;
  if (/婷婷|ting-?ting/i.test(label)) score += 10;
  if (/compact|eloquence|espeak/i.test(label)) score -= 40;
  if (!v.localService) score += 15; // cloud voices are usually the natural ones
  return score;
}

export default function useVoice() {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const voiceRef = useRef(null);
  const initedRef = useRef(false);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const all = speechSynthesis.getVoices();
      if (all.length === 0) return;
      const zh = all.filter(v => /^zh/i.test(v.lang));
      const pool = zh.length > 0 ? zh : all;
      voiceRef.current = pool.slice().sort((a, b) => voiceScore(b) - voiceScore(a))[0] || null;
      setReady(true);
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => { speechSynthesis.onvoiceschanged = null; };
  }, []);

  // iOS only allows speech that descends from a user gesture, so burn a silent
  // utterance on the first tap to unlock the queue for the rest of the session.
  const initOnGesture = useCallback(() => {
    if (initedRef.current || !('speechSynthesis' in window)) return;
    initedRef.current = true;
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    speechSynthesis.speak(u);
  }, []);

  const speak = useCallback((text) => {
    if (!enabled || !text || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voiceRef.current ? voiceRef.current.lang : 'zh-TW';
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = 0.95;
      u.pitch = 1;
      u.volume = 1;
      speechSynthesis.speak(u);
    } catch { /* speech is optional, never break the timer over it */ }
  }, [enabled]);

  const cancel = useCallback(() => {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }, []);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      if (prev && 'speechSynthesis' in window) speechSynthesis.cancel();
      return !prev;
    });
  }, []);

  return { enabled, ready, speak, cancel, toggle, initOnGesture };
}
