self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

// Luister naar het push-signaal van de server (zelfs als het scherm uit staat)
self.addEventListener('push', event => {
    let data = { title: "BefCounter", body: "Er is een nieuwe actie gelogd!" };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: "icon-192.png",
        badge: "icon-192.png",
        vibrate: [200, 100, 200],
        sound: "default", // Dit triggert het standaard push-geluid van iOS/Android
        data: {
            url: "/"
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Wat gebeurt er als je op de melding klikt
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});