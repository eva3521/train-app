import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Yoga voice guidance hook.
 *
 * Supports two modes:
 * 1. Pre-recorded audio files (warm, natural) — files in /audio/yoga/*.mp3
 * 2. Fallback to Web Speech API if audio file not found
 *
 * Usage:
 *   speak('some text')                      → speechSynthesis fallback
 *   speak('some text', { audioId: 'pose_01' }) → plays /audio/yoga/pose_01.mp3
 */
export default function useVoice() {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const voiceRef = useRef(null);
  const initedRef = useRef(false);
  const currentAudioRef = useRef(null);

  // Load voices (fallback)
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
    // Unlock speechSynthesis
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    speechSynthesis.speak(u);
    // Unlock Audio context by playing a silent audio
    try {
      const a = new Audio();
      a.volume = 0;
      a.play().catch(() => {});
    } catch { /* ok */ }
  }, []);

  // Play pre-recorded mp3
  const playAudio = useCallback((audioId) => {
    return new Promise((resolve, reject) => {
      const url = `${import.meta.env.BASE_URL}audio/yoga/${audioId}.mp3`;
      const audio = new Audio(url);
      audio.volume = 1;
      currentAudioRef.current = audio;

      audio.onended = () => {
        currentAudioRef.current = null;
        resolve();
      };
      audio.onerror = () => {
        currentAudioRef.current = null;
        reject(new Error('Audio file not found'));
      };
      audio.play().catch(reject);
    });
  }, []);

  // Speak with speechSynthesis (fallback)
  const speakTTS = useCallback((text) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-TW';
    u.rate = 0.85;
    u.pitch = 0.95;
    u.volume = 1;
    if (voiceRef.current) u.voice = voiceRef.current;
    speechSynthesis.speak(u);
  }, []);

  /**
   * speak(text, options?)
   * options.audioId — if provided, tries pre-recorded file first
   */
  const speak = useCallback((text, options) => {
    if (!enabled || !text) return;

    // Stop any current playback
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    speechSynthesis.cancel();

    const audioId = options?.audioId;
    if (audioId) {
      // Try pre-recorded audio, fall back to TTS
      playAudio(audioId).catch(() => speakTTS(text));
    } else {
      speakTTS(text);
    }
  }, [enabled, playAudio, speakTTS]);

  const cancel = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    speechSynthesis.cancel();
  }, []);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      if (prev) {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        speechSynthesis.cancel();
      }
      return !prev;
    });
  }, []);

  return { enabled, ready, speak, cancel, toggle, initOnGesture };
}
