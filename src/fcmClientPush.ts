// Firebase Cloud Messaging (FCM HTTP v1) Client & Service Account Integration
// Configured for project: winbig-35a20

export const FCM_SERVICE_ACCOUNT = {
    type: "service_account",
    project_id: "winbig-35a20",
    private_key_id: "da9d6676baf06ae7b10b00fe6dbe1a44fe6517c8",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCR+3dKEFkNV/cW\nXxWRAOJg6OMgf2V6g8ASQQxclFc0oTg4783LhSrcwa3bMGh8JFfFRGfuA71Sugzd\nX7+3NrFNvC5KrR9hVMvHJRQkwKQ4vE/WQ+1uzvOx8uQWquLtMcFPoVWslMT8ZBKG\nsYrA6I7E8JbMHquMSGOkge0JFk6m7THR4Hf+PZKzvAzSrVxETCUe7no9iNeDUdhj\na+MvRld0onvE3L8J+FTNFn+AXjI6J33s5qNF54lBcLciAqPyj+oVOLP592ZHgOgy\nRZovYwh3u4SKu7tKHqqMkVrspumYXAumLY4WEB5iDbDa0xu07/WaZAWxhfSho/RQ\nyVTgfDMXAgMBAAECggEAE/PgZpWcblf3FC4z1uldh6xdGtx+xMOMNZKBe4fk8XMV\nqaaRJL+TT7ADMMHJjiozeulyIRSOxGdcicdj/0kw67SMSTWnY9jAr3vwaGOSLpUC\nfoEzSyFrKofNyBFcSdoyl00wVhHRaMPOym0qz1oZ5W4S1lxcyyQ7xkjh2oubfXIa\nNC/b0NlarCinuVqKeJFnjilhwb+uLE2T0DnY/BtnRMfmvsSyJaqH2QwiZKi1Y3b0\nvfR1IPW+12uzC+jMr93zDOqmV0JQsfrv4DxqQPIbcRxQJExjpZcE1Duheb6XUyoD\n340V1f3A52TwY9cZSyX1HGeY2GGW4aTC5yqbP9/i8QKBgQDBdA2wVYPeKJdx6wyB\n55fICvUSzzAOa+g156kehL2ptkCfmM+yuZY4k7vGwDKtd16DF+rbSzmNDl+uRoEo\nHlBRkvjeUtZjppzw1ILGXeEkLi1Aj/PJrwiRuGPgiQ/rB947riI98t0131oO7HyN\nMxo5/kzY0/xyzVubibAW0qSl8QKBgQDBLkecyLcW8Sl+2parX926jzI1OkM9JyNw\nu3lXetaL/HOtth6nyjZP2bpr6BQGZGChaNj/ZaRCcWH8mAFx+o4iYTEJked+2s2J\nGhrzydZ5x6taJ296UOOzFDYAyYfYZ1PQWlR3GnN1M+YCiSOGOfNVbZJUv6Fy/Wd/\nO77DLW7BhwKBgQCVcRR+CqGSxeKwIvaHh6Ot6iEGBb3G9j7tHWd85ugpKVxkrcSM\n+Wb9j8p4L9M2Q8dkF97axxLPT7JES7zMhBZh3dqYzH9HfdcxB8l6ed1JeM6GWG3o\neGlzQHEPbHI6itp3Wf6jwnB2hHLqom9ZGIgDEtrEiYY0HUXOMqAwEUsV0QKBgGam\nONdOsDs4mlwVusoFfsSLIpq2AtST33kfpTKeyzJHSxCbHV77TDDR+QUtpLZg0Bf0\nppnPYKENrouSGfJ+uNf73RrAtMnrahvYC0pPje/X8W1OVyYfpV6a9rckX1LWVOr5\nlLhVDdTRZv8h8AZ69JoIRyFRUnDPxhcNoCgGFDwxAoGBAKPJqrusMIlh6QP6y5Ax\n5uexBf9ZyUj7sk8mkGec0EE8p/BQkAiOHFEoUnYouVCPlW9jjUQ65QEJSUy5SJYe\nYmCMFfXbiWEeBqPYS5CRXBT1AH49SYKUA4XmBhKgx4StjH3vAYsNB/fqIJ27MW6Y\nKQnaxKAvEZGyP/1bYaYHB4KJ\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-fbsvc@winbig-35a20.iam.gserviceaccount.com",
    client_id: "102668851738828157004",
    token_uri: "https://oauth2.googleapis.com/token"
};

const RTDB_URL = "https://winbig-35a20-default-rtdb.firebaseio.com";

let cachedAccessToken: string | null = null;
let cachedTokenExpiry = 0;

function base64UrlEncodeString(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeBuffer(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64 = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s+/g, '');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export async function getFcmAccessToken(): Promise<string | null> {
    const nowSec = Math.floor(Date.now() / 1000);
    if (cachedAccessToken && cachedTokenExpiry > nowSec + 60) {
        return cachedAccessToken;
    }

    try {
        if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
            return null;
        }

        const header = { alg: 'RS256', typ: 'JWT' };
        const claimSet = {
            iss: FCM_SERVICE_ACCOUNT.client_email,
            scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database',
            aud: FCM_SERVICE_ACCOUNT.token_uri,
            iat: nowSec - 30,
            exp: nowSec + 3500
        };

        const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
        const encodedClaim = base64UrlEncodeString(JSON.stringify(claimSet));
        const unsignedJwt = `${encodedHeader}.${encodedClaim}`;

        const keyBuffer = pemToArrayBuffer(FCM_SERVICE_ACCOUNT.private_key);
        const cryptoKey = await window.crypto.subtle.importKey(
            'pkcs8',
            keyBuffer,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signatureBuffer = await window.crypto.subtle.sign(
            'RSASSA-PKCS1-v1_5',
            cryptoKey,
            new TextEncoder().encode(unsignedJwt)
        );

        const jwt = `${unsignedJwt}.${base64UrlEncodeBuffer(signatureBuffer)}`;

        const response = await fetch(FCM_SERVICE_ACCOUNT.token_uri, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(jwt)}`
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (data && data.access_token) {
            cachedAccessToken = data.access_token;
            cachedTokenExpiry = nowSec + (Number(data.expires_in) || 3500);
            return cachedAccessToken;
        }
    } catch (err) {
        console.warn('[FCM HTTP v1] Access token generation error:', err);
    }
    return null;
}

export async function registerUserFcmToken(uid: string, token: string): Promise<void> {
    if (!uid || !token) return;
    try {
        fetch('/api/fcm/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, token })
        }).catch(() => {});

        const accessToken = await getFcmAccessToken();
        if (accessToken) {
            const tokenKey = base64UrlEncodeString(token.slice(-32)).replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
            await Promise.all([
                fetch(`${RTDB_URL}/fcmTokens/${uid}.json?access_token=${encodeURIComponent(accessToken)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, uid, updatedAt: Date.now() })
                }),
                fetch(`${RTDB_URL}/users/${uid}/fcmTokens.json?access_token=${encodeURIComponent(accessToken)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [tokenKey]: token })
                })
            ]);
        }
    } catch (_) {}
}

export async function sendFcmHttpV1Push(params: {
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

    let cleanTitle = title ? title.trim() : 'Erena Esports 🏆';
    if (!cleanTitle || cleanTitle.toLowerCase() === 'new' || cleanTitle.toLowerCase() === 'notification') {
        cleanTitle = 'Erena Esports 🏆';
    } else if (!cleanTitle.toLowerCase().includes('erena')) {
        cleanTitle = `Erena Esports - ${cleanTitle}`;
    }

    const cleanBody = body || 'New tournament update available!';
    const cleanTag = tag || `erena_${Date.now()}`;
    const cleanIcon = (icon && !icon.startsWith('data:')) ? icon : '/assets/icon-192.png';
    const targetUrl = url || '/';
    const httpsImage = (image && image.startsWith('https://')) ? image : '';
    const httpsLink = (targetUrl && targetUrl.startsWith('https://')) ? targetUrl : 'https://winbig-35a20.web.app/';

    try {
        const accessToken = await getFcmAccessToken();
        if (accessToken) {
            const messagePayload: any = {
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

            const fcmRes = await fetch(
                `https://fcm.googleapis.com/v1/projects/${FCM_SERVICE_ACCOUNT.project_id}/messages:send`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(messagePayload)
                }
            );
            if (fcmRes.ok) return true;
        }
    } catch (_) {}

    try {
        const res = await fetch('/api/fcm/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                title: cleanTitle,
                body: cleanBody,
                icon: cleanIcon,
                image,
                tag: cleanTag,
                url: targetUrl
            })
        });
        if (res.ok) return true;
    } catch (_) {}

    return false;
}

export async function sendFcmTopicPush(params: {
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

    let cleanTitle = title ? title.trim() : 'Erena Esports 🏆';
    if (!cleanTitle || cleanTitle.toLowerCase() === 'new' || cleanTitle.toLowerCase() === 'notification') {
        cleanTitle = 'Erena Esports 🏆';
    } else if (!cleanTitle.toLowerCase().includes('erena')) {
        cleanTitle = `Erena Esports - ${cleanTitle}`;
    }

    const cleanBody = body || 'New tournament update available!';
    const cleanTag = tag || `erena_${Date.now()}`;
    const cleanIcon = icon || '/assets/icon-192.png';
    const targetUrl = url || '/';
    const httpsImage = (image && image.startsWith('https://')) ? image : '';
    const httpsLink = (targetUrl && targetUrl.startsWith('https://')) ? targetUrl : '';

    try {
        const accessToken = await getFcmAccessToken();
        if (!accessToken) return false;

        // Data-only payload formatted for AppMintMessagingService in APK so Android wakes up
        // AppMintMessagingService.onMessageReceived even when the APK is closed/never opened.
        const messagePayload: any = {
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

        const fcmRes = await fetch(
            `https://fcm.googleapis.com/v1/projects/${FCM_SERVICE_ACCOUNT.project_id}/messages:send`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(messagePayload)
            }
        );
        return fcmRes.ok;
    } catch (_) {
        return false;
    }
}

export async function dispatchGlobalNotificationFcm(notifKey: string, notif: any): Promise<void> {
    if (!notifKey || !notif || notif.fcmServerSentV2 === true) return;

    // Trigger backend broadcast endpoint if available
    fetch('/api/fcm/broadcast', { method: 'POST' }).catch(() => {});

    // Also run direct Service Account FCM broadcast so it works even on static/APK hosts
    try {
        const accessToken = await getFcmAccessToken();
        if (!accessToken) return;

        // Check if already marked fcmServerSentV2
        const checkRes = await fetch(`${RTDB_URL}/notifications/${notifKey}/fcmServerSentV2.json?access_token=${encodeURIComponent(accessToken)}`);
        if (checkRes.ok) {
            const already = await checkRes.json();
            if (already === true) return;
        }

        await fetch(`${RTDB_URL}/notifications/${notifKey}.json?access_token=${encodeURIComponent(accessToken)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fcmDispatched: true, fcmSentToUsers: true, fcmServerSentV2: true })
        });

        const [usersRes, fcmTokensRes] = await Promise.all([
            fetch(`${RTDB_URL}/users.json?access_token=${encodeURIComponent(accessToken)}`).catch(() => null),
            fetch(`${RTDB_URL}/fcmTokens.json?access_token=${encodeURIComponent(accessToken)}`).catch(() => null)
        ]);
        const usersData = (usersRes && usersRes.ok) ? await usersRes.json() : null;
        const fcmTokensData = (fcmTokensRes && fcmTokensRes.ok) ? await fcmTokensRes.json() : null;
        const tokenSet = new Set<string>();

        if (usersData && typeof usersData === 'object') {
            for (const u of Object.values<any>(usersData)) {
                if (!u || typeof u !== 'object' || u.userDisabledNotifications === true) continue;
                if (typeof u.fcmToken === 'string' && u.fcmToken.trim().length > 20) {
                    tokenSet.add(u.fcmToken.trim());
                }
                if (u.fcmTokens && typeof u.fcmTokens === 'object') {
                    for (const t of Object.values<any>(u.fcmTokens)) {
                        if (typeof t === 'string' && t.trim().length > 20) {
                            tokenSet.add(t.trim());
                        }
                    }
                }
            }
        }

        if (fcmTokensData && typeof fcmTokensData === 'object') {
            for (const entry of Object.values<any>(fcmTokensData)) {
                if (!entry) continue;
                if (typeof entry === 'string' && entry.trim().length > 20) {
                    tokenSet.add(entry.trim());
                } else if (typeof entry === 'object') {
                    if (typeof entry.token === 'string' && entry.token.trim().length > 20) {
                        tokenSet.add(entry.token.trim());
                    }
                    if (entry.tokens && typeof entry.tokens === 'object') {
                        for (const t of Object.values<any>(entry.tokens)) {
                            if (typeof t === 'string' && t.trim().length > 20) {
                                tokenSet.add(t.trim());
                            }
                        }
                    }
                }
            }
        }

        const notifTitle = notif.title || 'Erena Esports 🏆';
        const notifBody = notif.message || notif.body || notif.text || 'New tournament update available!';
        const notifIcon = notif.imageUrl || notif.icon || '/assets/icon-192.png';
        const notifImage = notif.imageUrl || notif.image;
        const notifTag = `global_${notifKey}`;

        const apkTopics = [
            'app_com_myapp_com',
            'app_Com_winbig',
            'app_com_winbig',
            'app_Com_bitu_com',
            'app_com_bitu_com',
            'app_Bitu_com',
            'app_bitu_com',
            'all',
            'all_users'
        ];
        for (const topic of apkTopics) {
            sendFcmTopicPush({
                topic,
                title: notifTitle,
                body: notifBody,
                icon: notifIcon,
                image: notifImage,
                tag: notifTag
            }).catch(() => {});
        }

        for (const token of Array.from(tokenSet)) {
            sendFcmHttpV1Push({
                token,
                title: notifTitle,
                body: notifBody,
                icon: notifIcon,
                image: notifImage,
                tag: notifTag
            }).catch(() => {});
        }
    } catch (_) {}
}
