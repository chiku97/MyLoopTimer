// Global State Variables
let timerWorker = null;
let currentLoop = 0;
let totalLoops = 0;
let isInfinite = true;
let totalSecondsPerLoop = 0;
let secondsRemaining = 0;
let timerState = 'idle'; // 'idle', 'running', 'paused'
let wakeLock = null;
let deferredPrompt = null;
let audioCtx = null;

// Sound synthesis frequencies mapping
const SOUND_PRESETS = {
  bell: 'bell',
  chime: 'chime',
  pulse: 'pulse',
  beep: 'beep',
  none: 'none'
};

// SVG Progress Ring calculations
const RING_RADIUS = 90;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~565.486

// DOM Elements
const hoursInput = document.getElementById('input-hours');
const minutesInput = document.getElementById('input-minutes');
const secondsInput = document.getElementById('input-seconds');
const loopsLimitInput = document.getElementById('input-loops-limit');
const infiniteLoopsChk = document.getElementById('chk-infinite-loops');
const wakeLockChk = document.getElementById('chk-wake-lock');
const soundSelect = document.getElementById('select-sound');
const volumeSlider = document.getElementById('slider-volume');
const volumeValLabel = document.getElementById('volume-val');

const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const btnInstall = document.getElementById('btn-install');
const btnNotifyBadge = document.getElementById('btn-notification-badge');
const notifyBadgeText = document.getElementById('notification-badge-text');
const boxNotifyPrompt = document.getElementById('box-notify-prompt');
const btnRequestPermission = document.getElementById('btn-request-permission');

const timerCountdown = document.getElementById('timer-countdown');
const timerStatus = document.getElementById('timer-status');
const timerLoopCount = document.getElementById('timer-loop-count');
const progressRingBar = document.getElementById('progress-ring-bar');

const guideHeaderToggle = document.getElementById('guide-header-toggle');
const guideDrawer = document.getElementById('guide-drawer');
const guideChevron = document.getElementById('guide-chevron');

const logList = document.getElementById('log-list');
const btnClearLog = document.getElementById('btn-clear-log');

// New Custom Notification and Preset Elements
const chkCustomNotify = document.getElementById('chk-custom-notify');
const customNotifyFields = document.getElementById('custom-notify-fields');
const inputNotifyTitle = document.getElementById('input-notify-title');
const inputNotifyBody = document.getElementById('input-notify-body');
const btnPresets = document.querySelectorAll('.btn-preset');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  initPWA();
  initNotificationPermission();
  initEventListeners();
  initTimerUI();
  loadLogs();
});

// ==========================================
// 1. PWA & Service Worker Registration
// ==========================================
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registered successfully:', reg.scope))
        .catch(err => console.error('Service Worker registration failed:', err));
    });
  }

  // Handle PWA installation prompts
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btnInstall.classList.remove('hidden'); // Show install button
  });

  btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA Installation Prompt outcome: ${outcome}`);
    if (outcome === 'accepted') {
      btnInstall.classList.add('hidden');
    }
    deferredPrompt = null;
  });

  window.addEventListener('appinstalled', () => {
    console.log('PWA app installed successfully');
    btnInstall.classList.add('hidden');
    addLog('System', 'App installed as standalone application.');
  });
}

// ==========================================
// 2. Notification Permissions Setup
// ==========================================
function initNotificationPermission() {
  if (!('Notification' in window)) {
    notifyBadgeText.innerText = 'Unsupported Device';
    btnNotifyBadge.className = 'badge-notification warning';
    boxNotifyPrompt.innerHTML = '<p>Your device or browser does not support native OS notifications.</p>';
    return;
  }

  updateNotificationBadge(Notification.permission);

  btnNotifyBadge.addEventListener('click', requestNotificationPermission);
  btnRequestPermission.addEventListener('click', requestNotificationPermission);
}

function updateNotificationBadge(permission) {
  if (permission === 'granted') {
    notifyBadgeText.innerText = 'Notifications Enabled';
    btnNotifyBadge.className = 'badge-notification success';
    boxNotifyPrompt.classList.add('hidden');
  } else if (permission === 'denied') {
    notifyBadgeText.innerText = 'Notifications Denied';
    btnNotifyBadge.className = 'badge-notification warning';
    boxNotifyPrompt.classList.remove('hidden');
    boxNotifyPrompt.querySelector('p').innerText = 'Notifications are blocked by your browser settings. Enable them in your address bar lock menu to get OS alerts.';
  } else {
    notifyBadgeText.innerText = 'Setup Notifications';
    btnNotifyBadge.className = 'badge-notification warning';
    boxNotifyPrompt.classList.remove('hidden');
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  
  const permission = await Notification.requestPermission();
  updateNotificationBadge(permission);
  
  if (permission === 'granted') {
    addLog('System', 'Native OS notification permissions granted.');
    // Show a test notification to confirm
    new Notification('Loop Timer', {
      body: 'Notifications are successfully configured! You will receive native system alerts.',
      icon: './icon.svg'
    });
  } else {
    addLog('System', 'Notification permissions were denied.');
  }
}

// ==========================================
// 3. Web Audio API Chimes (Dynamic Synthesizer)
// ==========================================
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSoundAlert() {
  initAudio();
  const type = soundSelect.value;
  const volume = parseFloat(volumeSlider.value);
  if (type === 'none' || volume === 0) return;

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  gainNode.gain.setValueAtTime(0, now);

  if (type === 'beep') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5 note
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.16);
  } 
  
  else if (type === 'bell') {
    // Beautiful metal bell: combination of a fundamental and high overtone
    const osc2 = audioCtx.createOscillator();
    const gainNode2 = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5 fundamental
    osc.connect(gainNode);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now); // D6 octave
    osc2.connect(gainNode2);
    gainNode2.connect(audioCtx.destination);
    
    gainNode.gain.linearRampToValueAtTime(volume * 0.7, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    
    gainNode2.gain.setValueAtTime(0, now);
    gainNode2.gain.linearRampToValueAtTime(volume * 0.35, now + 0.005);
    gainNode2.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 1.6);
    osc2.stop(now + 1.6);
  } 
  
  else if (type === 'chime') {
    // Cyber chime: rapid ascending arpeggio (C5 - E5 - G5 - C6)
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((freq, idx) => {
      const timeOffset = idx * 0.08;
      const oscNode = audioCtx.createOscillator();
      const gainNodeNode = audioCtx.createGain();
      
      oscNode.type = 'triangle';
      oscNode.frequency.setValueAtTime(freq, now + timeOffset);
      oscNode.connect(gainNodeNode);
      gainNodeNode.connect(audioCtx.destination);
      
      gainNodeNode.gain.setValueAtTime(0, now + timeOffset);
      gainNodeNode.gain.linearRampToValueAtTime(volume * 0.7, now + timeOffset + 0.01);
      gainNodeNode.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.55);
      
      oscNode.start(now + timeOffset);
      oscNode.stop(now + timeOffset + 0.6);
    });
  } 
  
  else if (type === 'pulse') {
    // Pulse alarm: 3 short deep warning beeps
    const pulses = 3;
    const pulseLen = 0.12;
    const gap = 0.15;
    
    for (let i = 0; i < pulses; i++) {
      const pulseStart = now + i * (pulseLen + gap);
      const oscNode = audioCtx.createOscillator();
      const gainNodeNode = audioCtx.createGain();
      
      oscNode.type = 'square';
      oscNode.frequency.setValueAtTime(220, pulseStart); // Low A3
      
      // Warm lowpass filter to remove harsh edge of square wave
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, pulseStart);
      
      oscNode.connect(filter);
      filter.connect(gainNodeNode);
      gainNodeNode.connect(audioCtx.destination);
      
      gainNodeNode.gain.setValueAtTime(0, pulseStart);
      gainNodeNode.gain.linearRampToValueAtTime(volume, pulseStart + 0.01);
      gainNodeNode.gain.exponentialRampToValueAtTime(0.0001, pulseStart + pulseLen);
      
      oscNode.start(pulseStart);
      oscNode.stop(pulseStart + pulseLen + 0.02);
    }
  }
}

let silentAudioElement = null;

function startSilentAudioPlay() {
  initAudio();
  if (!silentAudioElement) {
    // 1-second silent WAV file data URI
    silentAudioElement = new Audio('data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==');
    silentAudioElement.loop = true;
    silentAudioElement.volume = 0.05; // Low volume, silent audio clip
  }
  
  silentAudioElement.play()
    .then(() => console.log('Silent audio keep-alive started.'))
    .catch(err => console.warn('Could not start silent audio keep-alive:', err));
}

function stopSilentAudioPlay() {
  if (silentAudioElement) {
    try {
      silentAudioElement.pause();
      silentAudioElement.currentTime = 0;
    } catch (e) {}
  }
}

// ==========================================
// 4. Timer Logic and Web Worker Lifecycle
// ==========================================
function initTimerWorker() {
  if (timerWorker) return;
  timerWorker = new Worker('timer-worker.js');
  
  timerWorker.onmessage = (event) => {
    const { type, secondsRemaining: remaining } = event.data;
    
    if (type === 'tick') {
      secondsRemaining = remaining;
      updateCountdownDisplay(secondsRemaining);
      updateProgressRing(secondsRemaining);
    } 
    
    else if (type === 'completed') {
      handleLoopCompletion();
    }
    
    else if (type === 'reset') {
      resetTimerState();
    }
  };
}

function startTimer() {
  // Try initializing Web Audio Context
  initAudio();
  
  if (timerState === 'idle') {
    // Calculate seconds from input
    const hours = parseInt(hoursInput.value) || 0;
    const minutes = parseInt(minutesInput.value) || 0;
    const seconds = parseInt(secondsInput.value) || 0;
    
    totalSecondsPerLoop = (hours * 3600) + (minutes * 60) + seconds;
    
    if (totalSecondsPerLoop <= 0) {
      alert('Please set a duration greater than 0 seconds.');
      return;
    }
    
    // Read limits
    isInfinite = infiniteLoopsChk.checked;
    totalLoops = isInfinite ? Infinity : (parseInt(loopsLimitInput.value) || 1);
    currentLoop = 1;
    
    initTimerWorker();
    
    // Request Wake Lock
    requestWakeLock();
    
    // Start Worker
    timerWorker.postMessage({ action: 'start', value: totalSecondsPerLoop });
    timerState = 'running';
    
    // Start silent background audio to prevent CPU suspension
    startSilentAudioPlay();
    
    addLog('Timer Started', `Loop 1 of ${isInfinite ? '∞' : totalLoops} (${formatSeconds(totalSecondsPerLoop)})`);
  } 
  
  else if (timerState === 'paused') {
    requestWakeLock();
    timerWorker.postMessage({ action: 'resume' });
    timerState = 'running';
    
    // Resume silent background audio
    startSilentAudioPlay();
    
    addLog('Timer Resumed', `Continuing loop ${currentLoop}`);
  }
  
  updateControlsUI();
}

function pauseTimer() {
  if (timerState !== 'running') return;
  
  timerWorker.postMessage({ action: 'pause' });
  timerState = 'paused';
  releaseWakeLock();
  stopSilentAudioPlay();
  updateControlsUI();
  addLog('Timer Paused', `Paused at ${formatSeconds(secondsRemaining)}`);
}

function resetTimer() {
  if (timerState === 'idle') return;
  
  if (timerWorker) {
    timerWorker.postMessage({ action: 'reset' });
  }
  
  releaseWakeLock();
  resetTimerState();
  addLog('Timer Reset', 'Timer cancelled and reset to configuration.');
}

function resetTimerState() {
  timerState = 'idle';
  currentLoop = 0;
  secondsRemaining = 0;
  
  stopSilentAudioPlay();
  updateCountdownDisplay(0);
  updateProgressRing(0);
  updateControlsUI();
}

function handleLoopCompletion() {
  // 1. Trigger Alert Notifications
  triggerOSNotification(currentLoop);
  
  // 2. Play synthesized Audio Alert
  playSoundAlert();
  
  addLog('Loop Complete', `Completed loop ${currentLoop} of ${isInfinite ? '∞' : totalLoops}`);

  // 3. Determine looping workflow
  if (isInfinite || currentLoop < totalLoops) {
    currentLoop++;
    
    // Reset ring quickly and restart worker
    updateProgressRing(totalSecondsPerLoop);
    setTimeout(() => {
      if (timerState === 'running' && timerWorker) {
        timerWorker.postMessage({ action: 'start', value: totalSecondsPerLoop });
        updateCountdownDisplay(totalSecondsPerLoop);
        timerLoopCount.innerText = `Loop ${currentLoop} / ${isInfinite ? '∞' : totalLoops}`;
        addLog('Loop Started', `Starting loop ${currentLoop} of ${isInfinite ? '∞' : totalLoops}`);
      }
    }, 200);
  } else {
    // Finished all loops
    addLog('Completed All', `Finished all ${totalLoops} loops successfully!`);
    resetTimerState();
    triggerOSNotification('All Loops Done!', 'Finished all configured timer cycles.');
  }
}

// OS Notification Generator
function triggerOSNotification(loopNumber, customBody) {
  let title = `Loop Timer Completed!`;
  let body = customBody || `Loop #${loopNumber} has finished. Next loop starting now!`;

  // Custom Notifications config override
  if (chkCustomNotify && chkCustomNotify.checked) {
    const customTitle = inputNotifyTitle.value.trim();
    const customBodyText = inputNotifyBody.value.trim();
    
    if (customBody && customBody.includes('Finished all')) {
      // It's the final complete alert
      title = customTitle ? `[Done] ${customTitle}` : 'All Loops Done!';
      body = customBody;
    } else {
      title = customTitle || 'Loop Timer Completed!';
      body = customBodyText || 'Loop #{loop} has finished. Next loop starting now!';
    }
  }

  // Format templates using regex replacements
  title = title.replace(/{loop}/gi, loopNumber);
  body = body.replace(/{loop}/gi, loopNumber);
  
  // Vibrate the physical device if API is supported (front-end alert)
  if (navigator.vibrate) {
    navigator.vibrate([300, 100, 300]);
  }

  const isHidden = document.visibilityState === 'hidden' || document.visibilityState === 'prerender';
  
  const options = {
    body: body,
    icon: './icon.svg',
    badge: './icon.svg',
    tag: 'loop-timer-toast',
    renotify: true,
    silent: !isHidden, // Silent if app is open (in-app chime handles sound), aloud/vibrate if minimized in background
    vibrate: [300, 100, 300] // Vibrate: 300ms on, 100ms off, 300ms on
  };

  // Trigger the notification using Service Worker registration if available, fallback to Notification constructor
  if (Notification.permission === 'granted') {
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options);
      }).catch(err => {
        console.warn('Service worker showNotification failed, trying fallback:', err);
        showFallbackNotification(title, options);
      });
    } else {
      showFallbackNotification(title, options);
    }
  } else {
    console.warn('Notifications permission is not granted. Cannot show alert.');
  }
}

function showFallbackNotification(title, options) {
  try {
    new Notification(title, {
      ...options,
      // If we are calling fallback, ensure it respects silent settings
      silent: options.silent
    });
  } catch (e) {
    console.error('Fallback Notification creation failed:', e);
  }
}

// ==========================================
// 5. Wake Lock API (Keep screen active)
// ==========================================
async function requestWakeLock() {
  if (!wakeLockChk.checked) return;
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Screen Wake Lock active');
      wakeLock.addEventListener('release', () => {
        console.log('Screen Wake Lock released');
      });
    } catch (err) {
      console.warn(`Could not request Wake Lock: ${err.message}`);
    }
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

// Re-request wake lock and trigger instant timer catch-up if tab becomes visible again
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    if (wakeLock !== null) {
      await requestWakeLock();
    }
    if (timerState === 'running' && timerWorker) {
      timerWorker.postMessage({ action: 'request_tick' });
    }
  }
});

// ==========================================
// 6. UI & Event Handling
// ==========================================
function initTimerUI() {
  progressRingBar.style.strokeDasharray = RING_CIRCUMFERENCE;
  updateProgressRing(0);
  updateCountdownDisplay(0);
}

function initEventListeners() {
  // Input triggers
  btnStart.addEventListener('click', startTimer);
  btnPause.addEventListener('click', pauseTimer);
  btnReset.addEventListener('click', resetTimer);
  
  infiniteLoopsChk.addEventListener('change', (e) => {
    loopsLimitInput.disabled = e.target.checked;
    if (e.target.checked) {
      loopsLimitInput.value = '';
    } else {
      loopsLimitInput.value = '5';
    }
  });

  // Sound select test trigger
  soundSelect.addEventListener('change', () => {
    initAudio();
    // Brief sound preview when they choose a sound
    setTimeout(() => playSoundAlert(), 150);
  });

  // Volume slider update
  volumeSlider.addEventListener('input', (e) => {
    const pct = Math.round(parseFloat(e.target.value) * 100);
    volumeValLabel.innerText = `${pct}%`;
  });

  // Trouble guide drawer toggle
  guideHeaderToggle.addEventListener('click', () => {
    guideDrawer.classList.toggle('collapsed');
    guideChevron.classList.toggle('rotated');
  });

  // Clear Log
  btnClearLog.addEventListener('click', clearLogs);

  // Quick Preset buttons event listeners
  btnPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      if (timerState !== 'idle') return;
      
      const secs = parseInt(btn.dataset.secs);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      
      hoursInput.value = h;
      minutesInput.value = m;
      secondsInput.value = s;
      
      btnPresets.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Trigger a brief preview sync of the countdown ring/text
      totalSecondsPerLoop = secs;
      updateCountdownDisplay(secs);
      updateProgressRing(secs);
    });
  });

  // Clear presets active state when typing manually
  const clearActivePresets = () => {
    btnPresets.forEach(b => b.classList.remove('active'));
  };
  hoursInput.addEventListener('input', clearActivePresets);
  minutesInput.addEventListener('input', clearActivePresets);
  secondsInput.addEventListener('input', clearActivePresets);

  // Custom Notifications config toggle
  chkCustomNotify.addEventListener('change', (e) => {
    if (e.target.checked) {
      customNotifyFields.classList.remove('hidden');
    } else {
      customNotifyFields.classList.add('hidden');
    }
  });
}

function updateCountdownDisplay(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  const paddedH = String(hrs).padStart(2, '0');
  const paddedM = String(mins).padStart(2, '0');
  const paddedS = String(secs).padStart(2, '0');
  
  timerCountdown.innerText = `${paddedH}:${paddedM}:${paddedS}`;
  
  // Set window tab title to countdown so user can track it
  if (timerState === 'running') {
    document.title = `(${paddedH}:${paddedM}:${paddedS}) Loop Timer`;
  } else if (timerState === 'paused') {
    document.title = `[Paused] Loop Timer`;
  } else {
    document.title = 'Loop Timer | Native OS Notifications';
  }
}

function updateProgressRing(remaining) {
  if (totalSecondsPerLoop === 0) {
    progressRingBar.style.strokeDashoffset = RING_CIRCUMFERENCE;
    return;
  }
  
  const pct = remaining / totalSecondsPerLoop;
  // Calculate offset. Ticking down, so offset goes from 0 (full) to CIRCUMFERENCE (empty)
  const offset = RING_CIRCUMFERENCE * (1 - pct);
  progressRingBar.style.strokeDashoffset = offset;
}

function updateControlsUI() {
  if (timerState === 'running') {
    btnStart.classList.add('hidden');
    btnPause.classList.remove('hidden');
    btnReset.disabled = false;
    
    // Disable setup fields during run
    hoursInput.disabled = true;
    minutesInput.disabled = true;
    secondsInput.disabled = true;
    infiniteLoopsChk.disabled = true;
    loopsLimitInput.disabled = true;
    btnPresets.forEach(btn => btn.disabled = true);
    
    timerStatus.innerText = 'Running';
    timerStatus.className = 'timer-status active';
    timerLoopCount.innerText = `Loop ${currentLoop} / ${isInfinite ? '∞' : totalLoops}`;
  } 
  
  else if (timerState === 'paused') {
    btnStart.classList.remove('hidden');
    btnPause.classList.add('hidden');
    btnReset.disabled = false;
    
    timerStatus.innerText = 'Paused';
    timerStatus.className = 'timer-status';
  } 
  
  else { // idle
    btnStart.classList.remove('hidden');
    btnPause.classList.add('hidden');
    btnReset.disabled = true;
    
    // Enable setup fields
    hoursInput.disabled = false;
    minutesInput.disabled = false;
    secondsInput.disabled = false;
    infiniteLoopsChk.disabled = false;
    loopsLimitInput.disabled = infiniteLoopsChk.checked;
    btnPresets.forEach(btn => btn.disabled = false);
    
    timerStatus.innerText = 'Ready';
    timerStatus.className = 'timer-status';
    timerLoopCount.innerText = `Loop 0 / ${infiniteLoopsChk.checked ? '--' : (loopsLimitInput.value || '--')}`;
  }
}

// ==========================================
// 7. Activity Logger
// ==========================================
function addLog(tag, message) {
  const timestamp = new Date().toLocaleTimeString();
  
  const logItem = {
    tag,
    message,
    timestamp
  };

  // Add to local logs storage
  const saved = getLogsFromStorage();
  saved.unshift(logItem); // Add to top
  // Keep last 50 logs only
  if (saved.length > 50) saved.pop();
  localStorage.setItem('loop_timer_logs', JSON.stringify(saved));

  renderLogItem(logItem, true);
}

function renderLogItem(logItem, prepend = false) {
  const emptyMsg = logList.querySelector('.empty-log-msg');
  if (emptyMsg) emptyMsg.remove();

  const el = document.createElement('div');
  el.className = 'log-item';
  el.innerHTML = `
    <span class="log-time">${logItem.timestamp}</span>
    <span class="log-tag">${logItem.tag}</span>
    <span class="log-msg">${logItem.message}</span>
  `;

  if (prepend) {
    logList.insertBefore(el, logList.firstChild);
  } else {
    logList.appendChild(el);
  }
}

function loadLogs() {
  logList.innerHTML = '';
  const saved = getLogsFromStorage();
  
  if (saved.length === 0) {
    logList.innerHTML = '<div class="empty-log-msg">No loops completed yet. Ready to record logs.</div>';
    return;
  }
  
  saved.forEach(item => renderLogItem(item));
}

function clearLogs() {
  localStorage.removeItem('loop_timer_logs');
  loadLogs();
}

function getLogsFromStorage() {
  try {
    return JSON.parse(localStorage.getItem('loop_timer_logs')) || [];
  } catch (e) {
    return [];
  }
}

// Helpers
function formatSeconds(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  const parts = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}
