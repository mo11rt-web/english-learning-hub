importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBKUoA8g-lSRPKLVGvs2a2mMTd8GB41jy4",
  authDomain: "english-learning-hub-c448a.firebaseapp.com",
  projectId: "english-learning-hub-c448a",
  storageBucket: "english-learning-hub-c448a.firebasestorage.app",
  messagingSenderId: "34204744235",
  appId: "1:34204744235:web:6bff3063a7b4c72e59c86e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'إشعار جديد من منصة English Hub';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    data: { url: payload.data?.url || '/' }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
