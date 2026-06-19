self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', event => {
    // Standaard teksten voor als er iets mis gaat
    let title = "BefCounter 🍻";
    let body = "Er is een nieuwe actie gelogd!";
    
    // Probeer de Make.com data uit te pakken
    if (event.data) {
        try {
            let payload = event.data.json();
            // Make.com stopt de data in het mapje 'notification', dus we halen het daar uit!
            title = payload.notification?.title || payload.title || title;
            body = payload.notification?.body || payload.body || body;
        } catch (e) {
            body = event.data.text();
        }
    }

    const options = {
        body: body,
        icon: "icon-192.png",
        badge: "icon-192.png",
        vibrate: [200, 100, 300, 100, 200], // Extra hard trillen!
        sound: "default", // Forceert het systeemgeluid
        requireInteraction: false, // Melding verdwijnt na een paar seconden
        data: {
            url: "/"
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

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