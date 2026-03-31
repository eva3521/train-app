import { useState, useRef, useCallback, useEffect } from 'react';

export default function useVoice() {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const voiceRef = useRef(null);
  const initedRef = useRef(false);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      voiceRef.current =
        voices.find(v => v.lang === 'zh-TW') ||
        voices.find(v => v.lang.startsWith('zh') && (v.lang.includes('TW') || v.lang.includes('HK'))) ||
        voices.find(v => v.lang.startsWith('zh')) ||
        null;
      if (voices.length > 0) setReady(true);
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Init on first gesture (for iOS autoplay policy)
  const initOnGesture = useCallback(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    speechSynthesis.speak(u);
  }, []);

  const speak = useCallback((text) => {
    if (!enabled || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-TW';
    u.rate = 0.85;
    u.pitch = 0.95;
    u.volume = 1;
    if (voiceRef.current) u.voice = voiceRef.current;
    speechSynthesis.speak(u);
  }, [enabled]);

  const cancel = useCallback(() => {
    speechSynthesis.cancel();
  }, []);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      if (prev) speechSynthesis.cancel();
      return !prev;
    });
  }, []);

  return { enabled, ready, speak, cancel, toggle, initOnGesture };
}
