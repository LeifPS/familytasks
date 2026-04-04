// FamilyTasks Service Worker
// Handles push notifications and scheduled reminders

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── Push notification received from server ──────────────────────────────────
self.addEventListener('push', event => {
    let data = { title: 'FamilyTasks', body: '', icon: '/icon-192.png' };
    try { data = { ...data, ...event.data.json() }; } catch(e) {}

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body:    data.body,
            icon:    data.icon || '/icon-192.png',
            badge:   '/icon-96.png',
            vibrate: [200, 100, 200],
            tag:     data.tag || 'familytasks',
            data:    data.url ? { url: data.url } : {},
            actions: data.actions || []
        })
    );
});

// ── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if (client.url.includes(self.location.origin)) {
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});

// ── Local reminder via periodic check ───────────────────────────────────────
// The app schedules reminders by posting messages to the SW.
// SW stores them and fires at the right time via setInterval.

let reminders = []; // { time: "HH:MM", memberId, memberName, familyId }

self.addEventListener('message', event => {
    if (!event.data) return;

    if (event.data.type === 'SET_REMINDER') {
        // Replace existing reminder for this member
        reminders = reminders.filter(r => r.memberId !== event.data.memberId);
        if (event.data.enabled) {
            reminders.push({
                time:       event.data.time,       // "18:30"
                memberId:   event.data.memberId,
                memberName: event.data.memberName,
                familyId:   event.data.familyId
            });
        }
    }

    if (event.data.type === 'CLEAR_REMINDER') {
        reminders = reminders.filter(r => r.memberId !== event.data.memberId);
    }
});

// Check reminders every minute
setInterval(() => {
    if (!reminders.length) return;
    const now = new Date();
    const hhmm = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');

    reminders.forEach(r => {
        if (r.time === hhmm) {
            // Ask the app if the child is already done
            self.clients.matchAll().then(clients => {
                let appOpen = false;
                clients.forEach(client => {
                    appOpen = true;
                    client.postMessage({ type: 'CHECK_REMINDER', memberId: r.memberId });
                });
                if (!appOpen) {
                    // App not open — fire reminder directly
                    fireReminder(r);
                }
            });
        }
    });
}, 60000);

// Called by app (via message) if child is NOT done yet
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'FIRE_REMINDER') {
        fireReminder(event.data);
    }
});

function fireReminder(r) {
    self.registration.showNotification('⏰ Aufgaben-Erinnerung', {
        body:    `Hey ${r.memberName}! Du hast noch Aufgaben offen. Erledige sie jetzt! 💪`,
        icon:    '/icon-192.png',
        badge:   '/icon-96.png',
        vibrate: [300, 100, 300, 100, 300],
        tag:     'reminder-' + r.memberId,
        renotify: true,
        requireInteraction: false
    });
}
