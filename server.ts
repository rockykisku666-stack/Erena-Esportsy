import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_ACCOUNT = {
    type: "service_account",
    project_id: "winbig-35a20",
    private_key_id: "da9d6676baf06ae7b10b00fe6dbe1a44fe6517c8",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCR+3dKEFkNV/cW\nXxWRAOJg6OMgf2V6g8ASQQxclFc0oTg4783LhSrcwa3bMGh8JFfFRGfuA71Sugzd\nX7+3NrFNvC5KrR9hVMvHJRQkwKQ4vE/WQ+1uzvOx8uQWquLtMcFPoVWslMT8ZBKG\nsYrA6I7E8JbMHquMSGOkge0JFk6m7THR4Hf+PZKzvAzSrVxETCUe7no9iNeDUdhj\na+MvRld0onvE3L8J+FTNFn+AXjI6J33s5qNF54lBcLciAqPyj+oVOLP592ZHgOgy\nRZovYwh3u4SKu7tKHqqMkVrspumYXAumLY4WEB5iDbDa0xu07/WaZAWxhfSho/RQ\nyVTgfDMXAgMBAAECggEAE/PgZpWcblf3FC4z1uldh6xdGtx+xMOMNZKBe4fk8XMV\nqaaRJL+TT7ADMMHJjiozeulyIRSOxGdcicdj/0kw67SMSTWnY9jAr3vwaGOSLpUC\nfoEzSyFrKofNyBFcSdoyl00wVhHRaMPOym0qz1oZ5W4S1lxcyyQ7xkjh2oubfXIa\nNC/b0NlarCinuVqKeJFnjilhwb+uLE2T0DnY/BtnRMfmvsSyJaqH2QwiZKi1Y3b0\nvfR1IPW+12uzC+jMr93zDOqmV0JQsfrv4DxqQPIbcRxQJExjpZcE1Duheb6XUyoD\n340V1f3A52TwY9cZSyX1HGeY2GGW4aTC5yqbP9/i8QKBgQDBdA2wVYPeKJdx6wyB\n55fICvUSzzAOa+g156kehL2ptkCfmM+yuZY4k7vGwDKtd16DF+rbSzmNDl+uRoEo\nHlBRkvjeUtZjppzw1ILGXeEkLi1Aj/PJrwiRuGPgiQ/rB947riI98t0131oO7HyN\nMxo5/kzY0/xyzVubibAW0qSl8QKBgQDBLkecyLcW8Sl+2parX926jzI1OkM9JyNw\nu3lXetaL/HOtth6nyjZP2bpr6BQGZGChaNj/ZaRCcWH8mAFx+o4iYTEJked+2s2J\nGhrzydZ5x6taJ296UOOzFDYAyYfYZ1PQWlR3GnN1M+YCiSOGOfNVbZJUv6Fy/Wd/\nO77DLW7BhwKBgQCVcRR+CqGSxeKwIvaHh6Ot6iEGBb3G9j7tHWd85ugpKVxkrcSM\n+Wb9j8p4L9M2Q8dkF97axxLPT7JES7zMhBZh3dqYzH9HfdcxB8l6ed1JeM6GWG3o\neGlzQHEPbHI6itp3Wf6jwnB2hHLqom9ZGIgDEtrEiYY0HUXOMqAwEUsV0QKBgGam\nONdOsDs4mlwVusoFfsSLIpq2AtST33kfpTKeyzJHSxCbHV77TDDR+QUtpLZg0Bf0\nppnPYKENrouSGfJ+uNf73RrAtMnrahvYC0pPje/X8W1OVyYfpV6a9rckX1LWVOr5\nlLhVDdTRZv8h8AZ69JoIRyFRUnDPxhcNoCgGFDwxAoGBAKPJqrusMIlh6QP6y5Ax\n5uexBf9ZyUj7sk8mkGec0EE8p/BQkAiOHFEoUnYouVCPlW9jjUQ65QEJSUy5SJYe\nYmCMFfXbiWEeBqPYS5CRXBT1AH49SYKUA4XmBhKgx4StjH3vAYsNB/fqIJ27MW6Y\nKQnaxKAvEZGyP/1bYaYHB4KJ\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-fbsvc@winbig-35a20.iam.gserviceaccount.com",
    client_id: "102668851738828157004",
    token_uri: "https://oauth2.googleapis.com/token"
};

const RTDB_URL = "https://winbig-35a20-default-rtdb.firebaseio.com";

let cachedToken: string | null = null;
let cachedTokenExp = 0;

function base64Url(input: Buffer | string): string {
    const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getGoogleAccessToken(): Promise<string | null> {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && cachedTokenExp > now + 60) {
        return cachedToken;
    }

    try {
        const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
        const payload = base64Url(JSON.stringify({
            iss: SERVICE_ACCOUNT.client_email,
            scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase.readonly',
            aud: SERVICE_ACCOUNT.token_uri,
            iat: now - 30,
            exp: now + 3500
        }));

        const unsigned = `${header}.${payload}`;
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(unsigned);
        signer.end();
        const signature = base64Url(signer.sign(SERVICE_ACCOUNT.private_key));
        const jwt = `${unsigned}.${signature}`;

        const res = await fetch(SERVICE_ACCOUNT.token_uri, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(jwt)}`
        });

        if (!res.ok) return null;
        const data: any = await res.json();
        if (data && data.access_token) {
            cachedToken = data.access_token;
            cachedTokenExp = now + (Number(data.expires_in) || 3500);
            return cachedToken;
        }
    } catch (err) {
        console.warn('[Server FCM] OAuth token error:', err);
    }
    return null;
}

function cleanNotificationTitle(rawTitle?: string): string {
    let t = rawTitle ? String(rawTitle).trim() : 'Erena Esports 🏆';
    if (!t || t.toLowerCase() === 'new' || t.toLowerCase() === 'notification') {
        return 'Erena Esports 🏆';
    }
    if (!t.toLowerCase().includes('erena')) {
        return `Erena Esports - ${t}`;
    }
    return t;
}

function extractNotifTimestamp(notif: any): number {
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

async function sendFcmPushToToken(params: {
    token: string;
    title: string;
    body: string;
    icon?: string;
    image?: string;
    tag?: string;
    url?: string;
}): Promise<boolean> {
    const { token, title, body, icon, image, tag, url } = params;
    if (!token) return false;

    const accessToken = await getGoogleAccessToken();
    if (!accessToken) return false;

    const cleanTitle = cleanNotificationTitle(title);
    const cleanBody = body || 'New tournament update available!';
    const cleanIcon = (icon && !icon.startsWith('data:')) ? icon : '/assets/icon-192.png';
    const cleanTag = tag || `erena_${Date.now()}`;
    const targetUrl = url || '/';
    const httpsImage = (image && image.startsWith('https://')) ? image : '';
    const httpsLink = (targetUrl && targetUrl.startsWith('https://')) ? targetUrl : 'https://winbig-35a20.web.app/';

    const payload: any = {
        message: {
            token: token,
            notification: {
                title: cleanTitle,
                body: cleanBody,
                ...(httpsImage ? { image: httpsImage } : {})
            },
            data: {
                amp_id: cleanTag,
                amp_type: 'show',
                amp_surface: 'both',
                amp_title: cleanTitle,
                amp_body: cleanBody,
                amp_image: httpsImage,
                amp_link: httpsLink,
                title: cleanTitle,
                body: cleanBody,
                message: cleanBody,
                icon: cleanIcon,
                tag: cleanTag,
                url: targetUrl,
                click_action: targetUrl,
                ...(httpsImage ? { image: httpsImage } : {})
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    defaultVibrateTimings: true,
                    defaultSound: true,
                    notificationPriority: 'PRIORITY_MAX',
                    visibility: 'PUBLIC',
                    tag: cleanTag
                }
            },
            webpush: {
                headers: {
                    Urgency: 'high',
                    TTL: '86400'
                },
                notification: {
                    title: cleanTitle,
                    body: cleanBody,
                    icon: cleanIcon,
                    badge: '/assets/icon-192.png',
                    tag: cleanTag,
                    renotify: true,
                    requireInteraction: true,
                    vibrate: [300, 100, 300, 100, 300],
                    ...(httpsImage ? { image: httpsImage } : {})
                },
                fcm_options: {
                    link: httpsLink
                }
            }
        }
    };

    try {
        const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/messages:send`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );
        return res.ok;
    } catch (e) {
        return false;
    }
}

// Sends a high-priority data-only FCM message formatted for AppMintMessagingService in the APK
// so Android wakes up AppMintMessagingService.onMessageReceived even when the APK is completely closed.
async function sendFcmPushToTopic(params: {
    topic: string;
    title: string;
    body: string;
    icon?: string;
    image?: string;
    tag?: string;
    url?: string;
}): Promise<boolean> {
    const { topic, title, body, icon, image, tag, url } = params;
    if (!topic) return false;

    const accessToken = await getGoogleAccessToken();
    if (!accessToken) return false;

    const cleanTitle = cleanNotificationTitle(title);
    const cleanBody = body || 'New tournament update available!';
    const cleanIcon = (icon && !icon.startsWith('data:')) ? icon : '/assets/icon-192.png';
    const cleanTag = tag || `erena_${Date.now()}`;
    const targetUrl = url || '/';
    const httpsImage = (image && image.startsWith('https://')) ? image : '';
    const httpsLink = (targetUrl && targetUrl.startsWith('https://')) ? targetUrl : '';

    const payload: any = {
        message: {
            topic: topic,
            data: {
                amp_id: cleanTag,
                amp_type: 'show',
                amp_surface: 'both',
                amp_title: cleanTitle,
                amp_body: cleanBody,
                amp_image: httpsImage,
                amp_link: httpsLink,
                title: cleanTitle,
                body: cleanBody,
                message: cleanBody,
                icon: cleanIcon,
                tag: cleanTag,
                url: targetUrl,
                click_action: targetUrl
            },
            android: {
                priority: 'high',
                ttl: '86400s'
            }
        }
    };

    try {
        const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/messages:send`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );
        return res.ok;
    } catch (e) {
        return false;
    }
}

const recentTopicBroadcasts = new Map<string, number>();

async function broadcastToApkTopics(
    apkTopics: string[],
    params: {
        title: string;
        body: string;
        icon?: string;
        image?: string;
        tag: string;
        url?: string;
    }
): Promise<void> {
    const cleanTitle = cleanNotificationTitle(params.title);
    const cleanBody = params.body || 'New tournament update available!';
    const dedupKey = `${cleanTitle}::${cleanBody}`;
    const now = Date.now();
    const lastSent = recentTopicBroadcasts.get(dedupKey) || 0;
    if (now - lastSent < 45000) {
        return;
    }
    recentTopicBroadcasts.set(dedupKey, now);

    for (const topic of apkTopics) {
        sendFcmPushToTopic({
            topic,
            title: cleanTitle,
            body: cleanBody,
            icon: params.icon,
            image: params.image,
            tag: params.tag,
            url: params.url
        }).catch(() => {});
    }
}

const APK_FCM_TOPICS_SET = new Set<string>([
    'app_com_myapp_com',
    'app_Com_winbig',
    'app_com_winbig',
    'app_Com_bitu_com',
    'app_com_bitu_com',
    'app_Bitu_com',
    'app_bitu_com',
    'all',
    'all_users'
]);

let lastTopicsSyncAt = 0;
async function getApkFcmTopics(accessToken: string): Promise<string[]> {
    const now = Date.now();
    if (now - lastTopicsSyncAt > 5 * 60 * 1000) {
        lastTopicsSyncAt = now;
        try {
            const res = await fetch(
                `https://firebase.googleapis.com/v1beta1/projects/${SERVICE_ACCOUNT.project_id}/androidApps`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            if (res.ok) {
                const data: any = await res.json();
                if (data && Array.isArray(data.apps)) {
                    for (const app of data.apps) {
                        const pkg = app && app.packageName ? String(app.packageName).trim() : '';
                        if (pkg) {
                            const exactTopic = 'app_' + pkg.replace(/[^a-zA-Z0-9]/g, '_');
                            const lowerTopic = 'app_' + pkg.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
                            APK_FCM_TOPICS_SET.add(exactTopic);
                            APK_FCM_TOPICS_SET.add(lowerTopic);
                        }
                    }
                }
            }
        } catch (_) {}
    }
    return Array.from(APK_FCM_TOPICS_SET);
}

// Gather all valid FCM tokens per user from both /users and /fcmTokens
async function collectAllUserTokens(accessToken: string): Promise<{
    userTokensMap: Record<string, string[]>;
    allTokens: string[];
    usersData: Record<string, any>;
}> {
    const userTokensMap: Record<string, string[]> = {};
    const tokenSet = new Set<string>();

    const addToken = (uid: string, tok: any) => {
        if (typeof tok === 'string' && tok.trim().length > 20) {
            const clean = tok.trim();
            if (!userTokensMap[uid]) userTokensMap[uid] = [];
            if (!userTokensMap[uid].includes(clean)) {
                userTokensMap[uid].push(clean);
            }
            tokenSet.add(clean);
        }
    };

    const [usersRes, fcmTokensRes] = await Promise.all([
        fetch(`${RTDB_URL}/users.json?access_token=${encodeURIComponent(accessToken)}`).catch(() => null),
        fetch(`${RTDB_URL}/fcmTokens.json?access_token=${encodeURIComponent(accessToken)}`).catch(() => null)
    ]);

    const usersData: Record<string, any> = (usersRes && usersRes.ok) ? (await usersRes.json() || {}) : {};
    const fcmTokensData: Record<string, any> = (fcmTokensRes && fcmTokensRes.ok) ? (await fcmTokensRes.json() || {}) : {};

    if (usersData && typeof usersData === 'object') {
        for (const [uid, u] of Object.entries<any>(usersData)) {
            if (!u || typeof u !== 'object') continue;
            if (u.userDisabledNotifications === true) continue;
            if (u.fcmToken) addToken(uid, u.fcmToken);
            if (u.fcmTokens && typeof u.fcmTokens === 'object') {
                for (const t of Object.values(u.fcmTokens)) {
                    addToken(uid, t);
                }
            }
        }
    }

    if (fcmTokensData && typeof fcmTokensData === 'object') {
        for (const [uid, entry] of Object.entries<any>(fcmTokensData)) {
            if (!entry) continue;
            if (typeof entry === 'string') {
                addToken(uid, entry);
            } else if (typeof entry === 'object') {
                if (entry.token) addToken(uid, entry.token);
                if (entry.tokens && typeof entry.tokens === 'object') {
                    for (const t of Object.values(entry.tokens)) {
                        addToken(uid, t);
                    }
                }
            }
        }
    }

    return {
        userTokensMap,
        allTokens: Array.from(tokenSet),
        usersData
    };
}

// Ensure RTDB rules allow fcmTokens write and heal any old false notificationsEnabled flags
async function ensureRtdbSetupAndPushRecent() {
    try {
        const accessToken = await getGoogleAccessToken();
        if (!accessToken) return;

        // 1. Ensure fcmTokens and deposits rules exist in RTDB security rules
        const rulesRes = await fetch(`${RTDB_URL}/.settings/rules.json?access_token=${encodeURIComponent(accessToken)}`);
        if (rulesRes.ok) {
            const rulesText = await rulesRes.text();
            let needsUpdate = false;
            try {
                const stripped = rulesText.replace(/\/\/.*$/gm, '');
                const parsed = JSON.parse(stripped);
                if (parsed && parsed.rules) {
                    if (!parsed.rules.fcmTokens) {
                        parsed.rules.fcmTokens = {
                            ".read": "auth != null",
                            "$uid": {
                                ".write": "auth != null && auth.uid === $uid"
                            }
                        };
                        needsUpdate = true;
                    }
                    if (!parsed.rules.deposits || !parsed.rules.deposits['.read']) {
                        parsed.rules.deposits = {
                            ".indexOn": ["status", "userId"],
                            ".read": "auth != null",
                            ".write": "auth != null"
                        };
                        needsUpdate = true;
                    }
                    if (needsUpdate) {
                        await fetch(`${RTDB_URL}/.settings/rules.json?access_token=${encodeURIComponent(accessToken)}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(parsed, null, 2)
                        });
                    }
                }
            } catch (_) {}
        }

        // 2. Sync existing user fcmTokens into /fcmTokens and heal old notificationsEnabled: false
        const [{ userTokensMap, allTokens, usersData }, apkTopics] = await Promise.all([
            collectAllUserTokens(accessToken),
            getApkFcmTopics(accessToken)
        ]);
        for (const [uid, tokens] of Object.entries(userTokensMap)) {
            if (tokens.length > 0) {
                fetch(`${RTDB_URL}/fcmTokens/${uid}.json?access_token=${encodeURIComponent(accessToken)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: tokens[0],
                        tokens: tokens,
                        uid,
                        updatedAt: Date.now()
                    })
                }).catch(() => {});

                if (usersData[uid] && usersData[uid].notificationsEnabled === false && !usersData[uid].userDisabledNotifications) {
                    fetch(`${RTDB_URL}/users/${uid}.json?access_token=${encodeURIComponent(accessToken)}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notificationsEnabled: true })
                    }).catch(() => {});
                }
            }
        }

        // 3. Check the latest global notification and ensure it was pushed to APK topics (fcmServerSentV2)
        const globalRes = await fetch(`${RTDB_URL}/notifications.json?orderBy="$key"&limitToLast=3&access_token=${encodeURIComponent(accessToken)}`);
        const globalData: any = globalRes.ok ? await globalRes.json() : null;
        if (globalData && typeof globalData === 'object') {
            const entries = Object.entries<any>(globalData);
            if (entries.length > 0) {
                const [latestKey, latestNotif] = entries[entries.length - 1];
                if (latestNotif && !latestNotif.fcmServerSentV2) {
                    dispatchedGlobalKeys.add(latestKey);
                    await fetch(`${RTDB_URL}/notifications/${latestKey}.json?access_token=${encodeURIComponent(accessToken)}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fcmDispatched: true, fcmSentToUsers: true, fcmServerSentV2: true })
                    }).catch(() => {});

                    broadcastToApkTopics(apkTopics, {
                        title: latestNotif.title || 'Erena Esports 🏆',
                        body: latestNotif.message || latestNotif.body || latestNotif.text || 'New tournament update available!',
                        icon: latestNotif.imageUrl || latestNotif.icon || '/assets/icon-192.png',
                        image: latestNotif.imageUrl || latestNotif.image,
                        tag: `global_${latestKey}`
                    }).catch(() => {});

                    for (const token of allTokens) {
                        sendFcmPushToToken({
                            token,
                            title: latestNotif.title || 'Erena Esports 🏆',
                            body: latestNotif.message || latestNotif.body || latestNotif.text || 'New tournament update available!',
                            icon: latestNotif.imageUrl || latestNotif.icon || '/assets/icon-192.png',
                            image: latestNotif.imageUrl || latestNotif.image,
                            tag: `global_${latestKey}`
                        }).catch(() => {});
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[Server FCM] Startup sync warning:', e);
    }
}

const dispatchedGlobalKeys = new Set<string>();
const dispatchedUserKeys = new Set<string>();
let initialSyncDone = false;
let isPolling = false;
let lastUserPollAt = 0;

async function pollRtdbNotificationsForFcm() {
    if (isPolling) return;
    isPolling = true;
    try {
        const accessToken = await getGoogleAccessToken();
        if (!accessToken) return;

        // 1. Fast check on global notifications first (~50ms)
        const globalRes = await fetch(`${RTDB_URL}/notifications.json?orderBy="$key"&limitToLast=10&access_token=${encodeURIComponent(accessToken)}`);
        const globalData: any = globalRes.ok ? await globalRes.json() : null;
        const now = Date.now();

        let hasNewGlobal = false;
        if (globalData && typeof globalData === 'object') {
            for (const [key, notif] of Object.entries<any>(globalData)) {
                if (!notif || !key) continue;
                const ts = extractNotifTimestamp(notif);
                const isVeryRecent = ts > (now - 120000);
                if (notif.fcmServerSentV2 === true || (!initialSyncDone && !isVeryRecent)) {
                    dispatchedGlobalKeys.add(key);
                    continue;
                }
                if (!dispatchedGlobalKeys.has(key)) {
                    hasNewGlobal = true;
                }
            }
        }

        const shouldCheckUsers = hasNewGlobal || !initialSyncDone || (now - lastUserPollAt > 3000);
        if (!shouldCheckUsers) {
            return;
        }
        lastUserPollAt = now;

        const [{ userTokensMap, allTokens, usersData }, apkTopics] = await Promise.all([
            collectAllUserTokens(accessToken),
            getApkFcmTopics(accessToken)
        ]);

        if (globalData && typeof globalData === 'object') {
            for (const [key, notif] of Object.entries<any>(globalData)) {
                if (!notif || !key) continue;
                const ts = extractNotifTimestamp(notif);
                const isVeryRecent = ts > (now - 120000);
                if (notif.fcmServerSentV2 === true || (!initialSyncDone && !isVeryRecent)) {
                    dispatchedGlobalKeys.add(key);
                    continue;
                }
                if (!dispatchedGlobalKeys.has(key)) {
                    dispatchedGlobalKeys.add(key);
                    await fetch(`${RTDB_URL}/notifications/${key}.json?access_token=${encodeURIComponent(accessToken)}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fcmDispatched: true, fcmSentToUsers: true, fcmServerSentV2: true })
                    }).catch(() => {});

                    broadcastToApkTopics(apkTopics, {
                        title: notif.title || 'Erena Esports 🏆',
                        body: notif.message || notif.body || notif.text || 'New tournament update available!',
                        icon: notif.imageUrl || notif.icon || '/assets/icon-192.png',
                        image: notif.imageUrl || notif.image,
                        tag: `global_${key}`
                    }).catch(() => {});

                    for (const token of allTokens) {
                        sendFcmPushToToken({
                            token,
                            title: notif.title || 'Erena Esports 🏆',
                            body: notif.message || notif.body || notif.text || 'New tournament update available!',
                            icon: notif.imageUrl || notif.icon || '/assets/icon-192.png',
                            image: notif.imageUrl || notif.image,
                            tag: `global_${key}`
                        }).catch(() => {});
                    }
                }
            }
        }

        // 2. Check user-specific notifications from already-fetched usersData
        for (const [uid, u] of Object.entries<any>(usersData)) {
            if (!u || typeof u !== 'object' || u.userDisabledNotifications === true) continue;
            const uNotifs = u.notifications;
            if (uNotifs && typeof uNotifs === 'object') {
                const tokens = userTokensMap[uid] || [];
                for (const [nKey, notif] of Object.entries<any>(uNotifs)) {
                    const compositeKey = `${uid}_${nKey}`;
                    if (!notif || !nKey) continue;
                    const ts = extractNotifTimestamp(notif);
                    const isVeryRecent = ts > (now - 120000);
                    if (notif.fcmServerSentV2 === true || (!initialSyncDone && !isVeryRecent)) {
                        dispatchedUserKeys.add(compositeKey);
                        continue;
                    }
                    if (!dispatchedUserKeys.has(compositeKey)) {
                        dispatchedUserKeys.add(compositeKey);
                        fetch(`${RTDB_URL}/users/${uid}/notifications/${nKey}.json?access_token=${encodeURIComponent(accessToken)}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fcmDispatched: true, fcmSentToUsers: true, fcmServerSentV2: true })
                        }).catch(() => {});

                        broadcastToApkTopics(apkTopics, {
                            title: notif.title || 'Erena Esports 🏆',
                            body: notif.message || notif.body || notif.text || 'You have a new update in Erena Esports!',
                            icon: notif.imageUrl || notif.icon || '/assets/icon-192.png',
                            image: notif.imageUrl || notif.image,
                            tag: `notif_${nKey}`
                        }).catch(() => {});

                        for (const token of tokens) {
                            sendFcmPushToToken({
                                token,
                                title: notif.title || 'Erena Esports 🏆',
                                body: notif.message || notif.body || notif.text || 'You have a new update in Erena Esports!',
                                icon: notif.imageUrl || notif.icon || '/assets/icon-192.png',
                                image: notif.imageUrl || notif.image,
                                tag: `notif_${nKey}`
                            }).catch(() => {});
                        }
                    }
                }
            }
        }

        initialSyncDone = true;
    } catch (err) {
        // Ignore transient network errors
    } finally {
        isPolling = false;
    }
}

// Real-time Server-Sent Events (SSE) listener on /notifications so pushes go out within milliseconds
let sseActive = false;
async function startRtdbNotificationsStream() {
    if (sseActive) return;
    sseActive = true;
    try {
        const accessToken = await getGoogleAccessToken();
        if (!accessToken) {
            sseActive = false;
            setTimeout(startRtdbNotificationsStream, 5000);
            return;
        }
        const res = await fetch(`${RTDB_URL}/notifications.json?access_token=${encodeURIComponent(accessToken)}`, {
            headers: { 'Accept': 'text/event-stream' }
        });
        if (!res.ok || !res.body) {
            sseActive = false;
            setTimeout(startRtdbNotificationsStream, 5000);
            return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            if (chunk.includes('event: put') || chunk.includes('event: patch')) {
                pollRtdbNotificationsForFcm().catch(() => {});
            }
        }
    } catch (_) {
        // Reconnect stream on disconnect
    } finally {
        sseActive = false;
        setTimeout(startRtdbNotificationsStream, 3000);
    }
}

async function startServer() {
    const app = express();
    app.use(express.json());

    app.post('/api/fcm/send', async (req, res) => {
        try {
            const { token, title, body, icon, image, tag, url } = req.body || {};
            if (!token) {
                res.status(400).json({ success: false, error: 'Missing FCM token' });
                return;
            }
            const ok = await sendFcmPushToToken({ token, title, body, icon, image, tag, url });
            res.json({ success: ok });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err?.message || 'Internal error' });
        }
    });

    app.post('/api/fcm/register', async (req, res) => {
        try {
            const { uid, token } = req.body || {};
            if (!uid || !token) {
                res.status(400).json({ success: false });
                return;
            }
            const accessToken = await getGoogleAccessToken();
            if (accessToken) {
                const tokenKey = Buffer.from(String(token).slice(-32)).toString('base64url').replace(/[^a-zA-Z0-9_-]/g, '');
                await Promise.all([
                    fetch(`${RTDB_URL}/fcmTokens/${uid}.json?access_token=${encodeURIComponent(accessToken)}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            token,
                            uid,
                            updatedAt: Date.now()
                        })
                    }),
                    fetch(`${RTDB_URL}/users/${uid}/fcmTokens.json?access_token=${encodeURIComponent(accessToken)}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            [tokenKey || 'default']: token
                        })
                    })
                ]);
            }
            res.json({ success: true });
        } catch (err: any) {
            res.status(500).json({ success: false });
        }
    });

    app.post('/api/fcm/broadcast', async (_req, res) => {
        try {
            await pollRtdbNotificationsForFcm();
            res.json({ success: true });
        } catch (err: any) {
            res.status(500).json({ success: false });
        }
    });

    // Tournament Prize Management Results Sync & API
    async function getOrSyncTournamentWinners(tId: string) {
        const accessToken = await getGoogleAccessToken();
        if (!accessToken) return null;

        const tRes = await fetch(`${RTDB_URL}/tournaments/${tId}.json?access_token=${encodeURIComponent(accessToken)}`);
        if (!tRes.ok) return null;
        const t = await tRes.json();
        if (!t) return null;

        const regPlayers = t.registeredPlayers || {};
        const entries = Object.entries<any>(regPlayers);
        const participantsWinnings: Record<string, { wonAmount: number; kills: number; rank: number }> = {};
        const winnersList: any[] = [];

        if (entries.length > 0) {
            await Promise.all(entries.map(async ([uid, p]: [string, any]) => {
                try {
                    const mhRes = await fetch(`${RTDB_URL}/users/${uid}/matchHistory/${tId}.json?access_token=${encodeURIComponent(accessToken)}`);
                    if (mhRes.ok) {
                        const mh = await mhRes.json();
                        if (mh) {
                            const won = Number(mh.earnings ?? mh.wonAmount ?? mh.prize ?? 0);
                            const kills = Number(mh.kills ?? 0);
                            const rank = Number(mh.rank ?? 0);
                            participantsWinnings[uid] = { wonAmount: won, kills, rank };
                            if (won > 0 || (rank > 0 && rank <= 5)) {
                                winnersList.push({
                                    uid,
                                    username: p?.username || p?.displayName || `Player_${uid.slice(-4)}`,
                                    wonAmount: won,
                                    kills,
                                    rank: rank || undefined
                                });
                            }
                        }
                    }
                } catch (_) {}
            }));
        }

        winnersList.sort((a, b) => {
            if (a.rank && b.rank && a.rank !== b.rank) return a.rank - b.rank;
            return b.wonAmount - a.wonAmount;
        });

        // Persist winners directly on tournament in RTDB if found
        if (winnersList.length > 0) {
            fetch(`${RTDB_URL}/tournaments/${tId}/winners.json?access_token=${encodeURIComponent(accessToken)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(winnersList)
            }).catch(() => {});
        }

        return {
            winners: winnersList.length > 0 ? winnersList : (t.winners || []),
            participantsWinnings
        };
    }

    async function syncAllCompletedTournaments() {
        try {
            const accessToken = await getGoogleAccessToken();
            if (!accessToken) return;
            const res = await fetch(`${RTDB_URL}/tournaments.json?orderBy="status"&equalTo="completed"&access_token=${encodeURIComponent(accessToken)}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data && typeof data === 'object') {
                for (const tId of Object.keys(data)) {
                    await getOrSyncTournamentWinners(tId);
                }
            }
        } catch (_) {}
    }

    async function syncAllUserDeposits() {
        try {
            const accessToken = await getGoogleAccessToken();
            if (!accessToken) return;
            const res = await fetch(`${RTDB_URL}/deposits.json?access_token=${encodeURIComponent(accessToken)}`);
            if (!res.ok) return;
            const deposits = await res.json();
            if (!deposits || typeof deposits !== 'object') return;

            const byUser: Record<string, any[]> = {};
            for (const [depId, dep] of Object.entries<any>(deposits)) {
                if (!dep || !dep.userId) continue;
                if (!byUser[dep.userId]) byUser[dep.userId] = [];
                byUser[dep.userId].push({ ...dep, id: depId });
            }

            for (const [uid, userDeps] of Object.entries(byUser)) {
                const txRes = await fetch(`${RTDB_URL}/transactions/${uid}.json?access_token=${encodeURIComponent(accessToken)}`);
                if (!txRes.ok) continue;
                const userTxs = await txRes.json();
                if (!userTxs || typeof userTxs !== 'object') continue;

                for (const [tId, tx] of Object.entries<any>(userTxs)) {
                    if (tx && tx.type === 'deposit_request') {
                        const dep = userDeps.find(d => d.id === tx.depositId || (d.utr && tx.utr && d.utr.trim().toLowerCase() === tx.utr.trim().toLowerCase()));
                        if (dep && (dep.status === 'completed' || dep.status === 'approved' || dep.status === 'rejected')) {
                            const newStatus = (dep.status === 'completed' || dep.status === 'approved') ? 'successful' : 'unsuccessful';
                            if (tx.status !== newStatus) {
                                await fetch(`${RTDB_URL}/transactions/${uid}/${tId}.json?access_token=${encodeURIComponent(accessToken)}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        status: newStatus,
                                        adminNote: dep.rejectReason || dep.adminNote || undefined
                                    })
                                });
                            }
                            await fetch(`${RTDB_URL}/users/${uid}/deposits/${dep.id}.json?access_token=${encodeURIComponent(accessToken)}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: dep.status })
                            }).catch(() => {});
                        }
                    }
                }
            }
        } catch (_) {}
    }

    app.get('/api/tournaments/:id/results', async (req, res) => {
        try {
            const tId = req.params.id;
            const data = await getOrSyncTournamentWinners(tId);
            if (!data) {
                res.status(404).json({ success: false, error: 'Tournament not found' });
                return;
            }
            res.json({ success: true, ...data });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err?.message || 'Internal error' });
        }
    });

    const MEDIAFIRE_APK_PAGE_URL = 'https://www.mediafire.com/file/mky19px6n3odqtx/base.apk/file';

    app.get('/api/download-apk', async (_req, res) => {
        try {
            const response = await fetch(MEDIAFIRE_APK_PAGE_URL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
                }
            });
            const html = await response.text();
            const match = html.match(/https:\/\/download[0-9]+\.mediafire\.com\/[^"'\s<>]+\.apk/i);
            if (match && match[0]) {
                res.redirect(302, match[0]);
                return;
            }
        } catch (_) {
            // Fallback to MediaFire page URL
        }
        res.redirect(302, MEDIAFIRE_APK_PAGE_URL);
    });

    app.get('/landing', (_req, res) => {
        res.sendFile(path.resolve(__dirname, 'public', 'landing.html'));
    });

    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.resolve(__dirname, 'dist');
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    const PORT = Number(process.env.PORT) || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
        ensureRtdbSetupAndPushRecent().then(() => {
            pollRtdbNotificationsForFcm();
            startRtdbNotificationsStream();
            setInterval(pollRtdbNotificationsForFcm, 1500);
            syncAllCompletedTournaments().catch(() => {});
            setInterval(syncAllCompletedTournaments, 30000);
            syncAllUserDeposits().catch(() => {});
            setInterval(syncAllUserDeposits, 10000);
        });
    });
}

startServer();
