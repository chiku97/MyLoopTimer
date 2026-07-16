let timerId = null;
let secondsRemaining = 0;

self.onmessage = function(event) {
  const { action, value } = event.data;

  if (action === 'start') {
    if (timerId) clearInterval(timerId);
    secondsRemaining = value; // value in seconds
    
    // Send immediate tick back to main thread
    self.postMessage({ type: 'tick', secondsRemaining });

    timerId = setInterval(() => {
      if (secondsRemaining > 0) {
        secondsRemaining--;
        self.postMessage({ type: 'tick', secondsRemaining });
      } else {
        // Loop completed
        self.postMessage({ type: 'completed' });
        clearInterval(timerId);
        timerId = null;
      }
    }, 1000);
  }

  else if (action === 'pause') {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  else if (action === 'resume') {
    if (timerId) clearInterval(timerId);
    
    timerId = setInterval(() => {
      if (secondsRemaining > 0) {
        secondsRemaining--;
        self.postMessage({ type: 'tick', secondsRemaining });
      } else {
        self.postMessage({ type: 'completed' });
        clearInterval(timerId);
        timerId = null;
      }
    }, 1000);
  }

  else if (action === 'reset') {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    secondsRemaining = 0;
    self.postMessage({ type: 'reset' });
  }
};
