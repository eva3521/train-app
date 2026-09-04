import { useRef, useState, useCallback, useEffect } from 'react';

export default function useTimer() {
  const workerRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const w = new Worker(`${import.meta.env.BASE_URL}timer.worker.js`);
    workerRef.current = w;
    w.onmessage = (e) => {
      if (e.data.elapsed !== undefined) setElapsed(e.data.elapsed);
      if (e.data.remaining !== undefined) setRemaining(e.data.remaining);
      if (e.data.done) {
        setDone(true);
        setRunning(false);
      }
    };
    return () => w.terminate();
  }, []);

  const startUp = useCallback(() => {
    setElapsed(0);
    setDone(false);
    setRunning(true);
    workerRef.current?.postMessage({ action: 'start', mode: 'up' });
  }, []);

  const startDown = useCallback((duration) => {
    setRemaining(duration);
    setDone(false);
    setRunning(true);
    workerRef.current?.postMessage({ action: 'start', mode: 'down', duration });
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    workerRef.current?.postMessage({ action: 'stop' });
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    setRemaining(0);
    setDone(false);
    workerRef.current?.postMessage({ action: 'reset' });
  }, []);

  return { elapsed, remaining, running, done, startUp, startDown, stop, reset };
}
