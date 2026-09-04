import { useRef, useCallback } from 'react';

/**
 * Short Web Audio beeps for timer cues.
 *
 * The AudioContext is created lazily and resumed on every beep because iOS
 * suspends it whenever the app goes to the background — without the resume,
 * the countdown goes silent after the first screen lock.
 */
export default function useBeep() {
  const ctxRef = useRef(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const beep = useCallback((freq = 880, duration = 0.15) => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch { /* silent fail */ }
  }, [getCtx]);

  // Call from a tap handler so the context exists before the first cue is due.
  const unlock = useCallback(() => { getCtx(); }, [getCtx]);

  return { beep, unlock };
}
