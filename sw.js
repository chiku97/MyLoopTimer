const CACHE_NAME = 'loop-timer-v1';
const ASSETS = [
  './',
  './styles.css',
  './app.js',
  './timer-worker.js',
  './manifest.json',
  './icon.svg'
];

// Install Service Worker and cache resources
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network falling back to cache strategy
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).catch(() => {
        // Return cached index.html as fallback if fetch fails
        if (e.request.mode === 'navigate') {
          return caches.match('./');
        }
      });
    })
  );
});

// Listen for background notifications sent from app.js when backgrounded
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    
    // Check if we have permission to show notifications
    if (Notification.permission === 'granted') {
      self.registration.showNotification(title, {
        body: options.body || 'Timer loop completed!',
        icon: './icon.svg',
        badge: './icon.svg',
        vibrate: [200, 100, 200],
        tag: 'loop-timer-notification',
        renotify: true,
        ...options
      });
    }
  }
});
