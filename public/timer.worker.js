// Web Worker for timer - survives iOS screen lock
let intervalId = null;
let value = 0;
let mode = 'up'; // 'up' = elapsed, 'down' = remaining

self.onmessage = function (e) {
  const { action, duration, mode: m } = e.data;

  switch (action) {
    case 'start':
      clearInterval(intervalId);
      mode = m || 'up';
      if (mode === 'down') {
        value = duration || 0;
      } else {
        value = 0;
      }
      intervalId = setInterval(() => {
        if (mode === 'down') {
          value--;
          self.postMessage({ remaining: value });
          if (value <= 0) {
            clearInterval(intervalId);
            intervalId = null;
            self.postMessage({ remaining: 0, done: true });
          }
        } else {
          value++;
          self.postMessage({ elapsed: value });
        }
      }, 1000);
      break;

    case 'stop':
      clearInterval(intervalId);
      intervalId = null;
      break;

    case 'reset':
      clearInterval(intervalId);
      intervalId = null;
      value = 0;
      self.postMessage(mode === 'down' ? { remaining: 0 } : { elapsed: 0 });
      break;
  }
};
