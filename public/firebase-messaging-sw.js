// Firebase Messaging & Realtime Background Service Worker
// WinBig Gaming / Erena Esports Tournament

try {
    importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-database-compat.js');
} catch (importErr) {
    console.warn('[firebase-messaging-sw.js] Firebase compat scripts failed to load:', importErr);
}

let swDb = null;
let currentUid = null;
let notificationsEnabled = true;
let userNotifRef = null;
let userSigRef = null;
let globalListenerAttached = false;
const shownTags = new Set();
const swStartTime = Date.now() - 30000;

function extractTimestamp(notif) {
    if (!notif) return 0;
    const raw = notif.timestamp ?? notif.createdAt ?? notif.time ?? notif.sentAt ?? notif.date;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
        const num = Number(raw);
        if (!isNaN(num) && num > 0) return num;
        const parsed = Date.parse(raw);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 0;
}

function formatNotifTitle(rawTitle) {
    let title = rawTitle ? String(rawTitle).trim() : 'Erena Esports';
    if (!title || title.toLowerCase() === 'new' || title.toLowerCase() === 'notification') {
        return 'Erena Esports 🏆';
    }
    if (!title.toLowerCase().includes('erena')) {
        return `Erena Esports - ${title}`;
    }
    return title;
}

async function displayBackgroundNotification(rawTitle, bodyText, extraOptions = {}) {
    if (!notificationsEnabled) return;
    if (!self.registration || typeof self.registration.showNotification !== 'function') return;

    const title = formatNotifTitle(rawTitle);
    const body = bodyText || 'New tournament update available!';
    const contentKey = `${title}::${body}`.slice(0, 120);
    const tag = extraOptions.tag || `erena_${contentKey}`;

    if (shownTags.has(tag)) return;
    shownTags.add(tag);

    const icon = extraOptions.icon || '/assets/icon-192.png';
    const image = extraOptions.image || extraOptions.imageUrl || undefined;

    const options = {
        body: body,
        icon: icon,
        badge: '/assets/icon-192.png',
        image: image,
        tag: tag,
        renotify: true,
        requireInteraction: false,
        vibrate: [300, 100, 300, 100, 300],
        data: extraOptions.data || { url: '/' },
        actions: [
            { action: 'open_tournament', title: '🎮 View Tournament' }
        ]
    };

    try {
        await self.registration.showNotification(title, options);
    } catch (err) {
        console.warn('[firebase-messaging-sw.js] showNotification error:', err);
    }
}

function attachGlobalRtdbListener() {
    if (!swDb || globalListenerAttached) return;
    globalListenerAttached = true;

    try {
        const globalRef = swDb.ref('notifications').limitToLast(15);
        const initialKeys = new Set();
        let initialLoaded = false;

        globalRef.once('value', (snap) => {
            if (snap && snap.exists()) {
                snap.forEach((child) => {
                    if (child.key) initialKeys.add(child.key);
                });
            }
            initialLoaded = true;
        }, () => {
            initialLoaded = true;
        });

        globalRef.on('child_added', async (snap) => {
            const val = snap.val();
            const key = snap.key;
            if (!val || !key) return;

            const ts = extractTimestamp(val);
            const isRecent = ts > swStartTime;
            const isNew = initialLoaded && !initialKeys.has(key);

            if (isNew || isRecent) {
                initialKeys.add(key);
                await displayBackgroundNotification(
                    val.title || 'Erena Esports',
                    val.message || val.body || val.text || 'New tournament update available!',
                    {
                        icon: val.imageUrl || val.icon || '/assets/icon-192.png',
                        image: val.imageUrl || val.image,
                        tag: `global_${key}`
                    }
                );
            } else {
                initialKeys.add(key);
            }
        });
    } catch (e) {
        console.warn('[firebase-messaging-sw.js] Global RTDB listener error:', e);
    }
}

function attachUserRtdbListeners(uid) {
    if (!swDb || !uid) return;
    if (currentUid === uid && userNotifRef) return;

    if (userNotifRef) {
        try { userNotifRef.off(); } catch (_) {}
        userNotifRef = null;
    }
    if (userSigRef) {
        try { userSigRef.off(); } catch (_) {}
        userSigRef = null;
    }

    currentUid = uid;

    try {
        userNotifRef = swDb.ref(`users/${uid}/notifications`).limitToLast(15);
        const initialUserKeys = new Set();
        let userLoaded = false;

        userNotifRef.once('value', (snap) => {
            if (snap && snap.exists()) {
                snap.forEach((child) => {
                    if (child.key) initialUserKeys.add(child.key);
                });
            }
            userLoaded = true;
        }, () => {
            userLoaded = true;
        });

        userNotifRef.on('child_added', async (snap) => {
            const val = snap.val();
            const key = snap.key;
            if (!val || !key) return;

            const ts = extractTimestamp(val);
            const isRecent = ts > swStartTime;
            const isNew = userLoaded && !initialUserKeys.has(key);

            if (isNew || isRecent) {
                initialUserKeys.add(key);
                await displayBackgroundNotification(
                    val.title || 'Erena Esports',
                    val.message || val.body || val.text || 'You have a new update in Erena Esports!',
                    {
                        icon: val.imageUrl || val.icon || '/assets/icon-192.png',
                        image: val.imageUrl || val.image,
                        tag: `notif_${key}`
                    }
                );
            } else {
                initialUserKeys.add(key);
            }
        });

        userSigRef = swDb.ref(`chats/sig_${uid}`).limitToLast(10);
        const initialSigKeys = new Set();
        let sigLoaded = false;

        userSigRef.once('value', (snap) => {
            if (snap && snap.exists()) {
                snap.forEach((child) => {
                    if (child.key) initialSigKeys.add(child.key);
                });
            }
            sigLoaded = true;
        }, () => {
            sigLoaded = true;
        });

        userSigRef.on('child_added', async (snap) => {
            const sig = snap.val();
            const key = snap.key;
            if (!sig || !key) return;

            const ts = extractTimestamp(sig);
            const isRecent = ts > swStartTime;
            const isNew = sigLoaded && !initialSigKeys.has(key);

            if (isNew || isRecent) {
                initialSigKeys.add(key);
                if (sig.type === 'chat_message' && sig.senderUid) {
                    await displayBackgroundNotification(
                        `Message from ${sig.senderName || 'Player'}`,
                        sig.text || 'Sent you a message',
                        {
                            icon: sig.senderPhoto || '/assets/icon-192.png',
                            tag: `chat_msg_${sig.senderUid}_${key}`
                        }
                    );
                } else if (sig.type === 'friend_request' && sig.senderUid) {
                    await displayBackgroundNotification(
                        `Friend Request: ${sig.senderName || 'Player'}`,
                        `${sig.senderName || 'A player'} sent you a friend request.`,
                        {
                            icon: sig.senderPhoto || '/assets/icon-192.png',
                            tag: `friend_req_${sig.senderUid}`
                        }
                    );
                }
            } else {
                initialSigKeys.add(key);
            }
        });
    } catch (e) {
        console.warn('[firebase-messaging-sw.js] User RTDB listener error:', e);
    }
}

try {
    if (typeof firebase !== 'undefined') {
        const firebaseConfig = {
            apiKey: "AIzaSyAX6CSPAOUxprHzFtP4Q_VDIHh9e-mXDuk",
            authDomain: "winbig-35a20.firebaseapp.com",
            databaseURL: "https://winbig-35a20-default-rtdb.firebaseio.com",
            projectId: "winbig-35a20",
            storageBucket: "winbig-35a20.firebasestorage.app",
            messagingSenderId: "43236019371",
            appId: "1:43236019371:web:67b9a76a5df8f8a9edfbee",
            measurementId: "G-L452B9VJBM"
        };

        if (!firebase.apps || firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }

        if (typeof firebase.database === 'function') {
            try {
                swDb = firebase.database();
                attachGlobalRtdbListener();
            } catch (dbErr) {
                console.warn('[firebase-messaging-sw.js] firebase.database() init warning:', dbErr);
            }
        }

        if (typeof firebase.messaging === 'function') {
            try {
                const messaging = firebase.messaging();
                if (messaging && typeof messaging.onBackgroundMessage === 'function') {
                    messaging.onBackgroundMessage((payload) => {
                        if (!notificationsEnabled) return;
                        const title = payload.notification?.title || payload.data?.title || payload.title || 'Erena Esports';
                        const body = payload.notification?.body || payload.data?.body || payload.data?.message || payload.body || 'New tournament update!';
                        const icon = payload.notification?.icon || payload.data?.icon || payload.icon || '/assets/icon-192.png';
                        const image = payload.notification?.image || payload.data?.image || payload.image || undefined;
                        const tag = (payload.data && payload.data.tag) || (payload.notification && payload.notification.tag) || undefined;

                        return displayBackgroundNotification(title, body, {
                            icon: icon,
                            image: image,
                            tag: tag,
                            data: payload.data || { url: '/' }
                        });
                    });
                }
            } catch (msgInitErr) {
                console.warn('[firebase-messaging-sw.js] firebase.messaging() warning:', msgInitErr);
            }
        }
    }
} catch (swInitErr) {
    console.warn('[firebase-messaging-sw.js] Init warning:', swInitErr);
}

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    if (!notificationsEnabled) return;
    try {
        let payload = null;
        if (event.data) {
            try {
                payload = event.data.json();
            } catch (_) {
                payload = { data: { message: event.data.text() } };
            }
        }

        const title = (payload && (payload.notification?.title || payload.data?.title || payload.title)) || 'Erena Esports';
        const body = (payload && (payload.notification?.body || payload.data?.body || payload.data?.message || payload.body)) || 'You have a new tournament notification!';
        const icon = (payload && (payload.notification?.icon || payload.data?.icon || payload.icon)) || '/assets/icon-192.png';
        const image = (payload && (payload.notification?.image || payload.data?.image || payload.image)) || undefined;
        const data = (payload && (payload.data || payload)) || { url: '/' };
        const tag = (data && data.tag) || (payload && payload.notification && payload.notification.tag) || undefined;

        event.waitUntil(
            displayBackgroundNotification(title, body, {
                icon: icon,
                image: image,
                tag: tag,
                data: data
            })
        );
    } catch (err) {
        console.warn('[firebase-messaging-sw.js] push event handling error:', err);
    }
});

self.addEventListener('notificationclick', (event) => {
    try {
        event.notification.close();
        const targetUrl = (event.notification.data && (event.notification.data.click_action || event.notification.data.url)) || '/';

        event.waitUntil(
            self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (self.clients && typeof self.clients.openWindow === 'function') {
                    return self.clients.openWindow(targetUrl);
                }
            })
        );
    } catch (err) {
        console.warn('[firebase-messaging-sw.js] notificationclick error:', err);
    }
});

self.addEventListener('message', (event) => {
    try {
        if (!event.data) return;

        if (event.data.type === 'SYNC_USER_STATE') {
            if (typeof event.data.notificationsEnabled === 'boolean') {
                notificationsEnabled = event.data.notificationsEnabled;
            }
            if (event.data.uid && notificationsEnabled) {
                attachGlobalRtdbListener();
                attachUserRtdbListeners(event.data.uid);
            }
        } else if (event.data.type === 'SHOW_NOTIFICATION') {
            if (!notificationsEnabled) return;
            const opts = event.data.options || {};
            event.waitUntil(
                displayBackgroundNotification(
                    event.data.title || 'Erena Esports',
                    opts.body || 'New tournament update!',
                    opts
                )
            );
        }
    } catch (err) {
        console.warn('[firebase-messaging-sw.js] message event error:', err);
    }
});
