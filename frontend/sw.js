const CACHE_NAME = 'mcs-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/features.html',
  '/pricing.html',
  '/get-started.html',
  '/dashboard/index.html',
  '/assets/css/main.css',
  '/assets/js/main.js',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.1/aos.css',
  'https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.1/aos.js'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.log('Cache installation failed:', error);
      })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // If both cache and network fail, return offline page
        if (event.request.destination === 'document') {
          return caches.match('/offline.html');
        }
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background sync for score updates
self.addEventListener('sync', event => {
  if (event.tag === 'background-score-update') {
    event.waitUntil(updateUserScore());
  }
});

// Push notifications for score changes
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/badge-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1,
        url: data.url || '/dashboard/index.html'
      },
      actions: [
        {
          action: 'explore',
          title: 'View Details',
          icon: '/assets/icons/checkmark.png'
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/assets/icons/xmark.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

async function updateUserScore() {
  try {
    // Background update of user score
    const response = await fetch('/api/v1/mcs/score/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'current_user',
        timestamp: Date.now()
      })
    });
    
    if (response.ok) {
      console.log('Score updated successfully in background');
    }
  } catch (error) {
    console.log('Background score update failed:', error);
  }
}

// Handle messages from main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});