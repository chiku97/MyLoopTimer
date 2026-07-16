let timerId = null;
let secondsRemaining = 0;
let targetEndTime = 0;

self.onmessage = function(event) {
  const { action, value } = event.data;

  if (action === 'start') {
    if (timerId) clearInterval(timerId);
    secondsRemaining = value; // value in seconds
    targetEndTime = Date.now() + (secondsRemaining * 1000);
    
    // Send immediate tick back to main thread
    self.postMessage({ type: 'tick', secondsRemaining });

    timerId = setInterval(() => {
      const now = Date.now();
      const diff = targetEndTime - now;
      if (diff > 0) {
        secondsRemaining = Math.ceil(diff / 1000);
        self.postMessage({ type: 'tick', secondsRemaining });
      } else {
        secondsRemaining = 0;
        self.postMessage({ type: 'completed' });
        clearInterval(timerId);
        timerId = null;
      }
    }, 200); // 200ms check for high accuracy and instant catchup
  }

  else if (action === 'pause') {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    const now = Date.now();
    secondsRemaining = Math.max(0, Math.ceil((targetEndTime - now) / 1000));
  }

  else if (action === 'resume') {
    if (timerId) clearInterval(timerId);
    
    targetEndTime = Date.now() + (secondsRemaining * 1000);
    
    timerId = setInterval(() => {
      const now = Date.now();
      const diff = targetEndTime - now;
      if (diff > 0) {
        secondsRemaining = Math.ceil(diff / 1000);
        self.postMessage({ type: 'tick', secondsRemaining });
      } else {
        secondsRemaining = 0;
        self.postMessage({ type: 'completed' });
        clearInterval(timerId);
        timerId = null;
      }
    }, 200);
  }

  else if (action === 'request_tick') {
    if (timerId) {
      const now = Date.now();
      const diff = targetEndTime - now;
      const calcSecs = diff > 0 ? Math.ceil(diff / 1000) : 0;
      self.postMessage({ type: 'tick', secondsRemaining: calcSecs });
    }
  }

  else if (action === 'reset') {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    secondsRemaining = 0;
    targetEndTime = 0;
    self.postMessage({ type: 'reset' });
  }
};
