import { initializeApp } from "firebase/app";
import {
    getDatabase, ref, get, set, update, push, remove, onDisconnect, query, orderByChild, equalTo,
    onValue, runTransaction, off, limitToLast, serverTimestamp, limitToFirst, onChildAdded, onChildChanged, onChildRemoved
} from "firebase/database";
import {
    getAuth, signOut, onAuthStateChanged, createUserWithEmailAndPassword,
    signInWithEmailAndPassword, sendPasswordResetEmail, User
} from "firebase/auth";
import {
    getMessaging, getToken, onMessage, isSupported as isMessagingSupported
} from "firebase/messaging";
import { sendFcmHttpV1Push, registerUserFcmToken, dispatchGlobalNotificationFcm } from "./fcmClientPush";
import erenaAvatarBlue from "./assets/images/erena_avatar_blue_1790760829079.jpg";
import erenaAvatarPink from "./assets/images/erena_avatar_pink_1790760842385.jpg";
import erenaAvatarGold from "./assets/images/erena_avatar_gold_1790760856667.jpg";
import erenaAvatarPurple from "./assets/images/erena_avatar_purple_1790760864980.jpg";
import erenaAvatarRed from "./assets/images/erena_avatar_red_1790760875903.jpg";

const AVATAR_COLLECTION: Array<{ id: string; url: string }> = [
    { id: 'avatar_1', url: 'https://i.pinimg.com/736x/8e/bd/91/8ebd919c5a45ff1e82d270c187066e18.jpg' },
    { id: 'avatar_2', url: 'https://i.pinimg.com/736x/c0/ec/aa/c0ecaaeb5a878502c8235b57f4083de7.jpg' },
    { id: 'avatar_3', url: 'https://i.pinimg.com/736x/a8/57/87/a857871d322f860ca11039ace1bf1c37.jpg' },
    { id: 'avatar_4', url: 'https://i.pinimg.com/736x/a7/a3/7b/a7a37bd4953b3493aaf0ed940b151fb2.jpg' },
    { id: 'avatar_5', url: 'https://i.pinimg.com/736x/85/01/7a/85017ad3ae4c5fb07992bbd360530bff.jpg' },
    { id: 'avatar_6', url: 'https://i.pinimg.com/736x/35/b2/b0/35b2b06d7ad1156fb0fd46fe5e328dba.jpg' },
    { id: 'avatar_7', url: erenaAvatarBlue },
    { id: 'avatar_8', url: erenaAvatarPink },
    { id: 'avatar_9', url: erenaAvatarGold },
    { id: 'avatar_10', url: erenaAvatarPurple },
    { id: 'avatar_11', url: erenaAvatarRed }
];

function resolveUserAvatarUrl(profileData: any, defaultFallbackUrl: string): string {
    if (!profileData) return defaultFallbackUrl;
    if (profileData.avatarId) {
        const found = AVATAR_COLLECTION.find(a => a.id === profileData.avatarId);
        if (found) return found.url;
    }
    if (profileData.avatarUrl && String(profileData.avatarUrl).trim()) {
        return String(profileData.avatarUrl).trim();
    }
    if (profileData.photoURL && String(profileData.photoURL).trim()) {
        return String(profileData.photoURL).trim();
    }
    return defaultFallbackUrl;
}

declare const bootstrap: any;
declare const Swiper: any;

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAX6CSPAOUxprHzFtP4Q_VDIHh9e-mXDuk",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "winbig-35a20.firebaseapp.com",
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://winbig-35a20-default-rtdb.firebaseio.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "winbig-35a20",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "winbig-35a20.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "43236019371",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:43236019371:web:67b9a76a5df8f8a9edfbee",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L452B9VJBM"
};

let app: any, db: any, auth: any;
let messaging: any = null;
let swRegistration: ServiceWorkerRegistration | null = null;
const appSessionStartTime = Date.now() - 5000;

try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    console.log("Firebase Initialized");
} catch (error: any) {
    console.error("Firebase initialization failed:", error);
    document.body.innerHTML = `<div class="alert alert-danger m-5 position-fixed top-0 start-0 end-0" style="z-index: 10000;">Critical Error: Could not connect to Firebase: ${error.message}</div>`;
}

// Helper to safely extract a numeric timestamp from notification payloads
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

// Helper to check if user has notifications enabled (defaults to true unless explicitly disabled by user)
function isNotificationsEnabled(profile?: any): boolean {
    const p = profile || userProfile;
    if (p && p.userDisabledNotifications === true) {
        return false;
    }
    try {
        const disabled = localStorage.getItem('erena_user_disabled_notifications');
        if (disabled === 'true') return false;
    } catch (_) {}
    return true;
}

// Sync user UID and notification preference with Service Worker for background RTDB alerts
async function syncServiceWorkerUserState(uid: string | null, enabled: boolean) {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
        const msg = {
            type: 'SYNC_USER_STATE',
            uid: uid,
            notificationsEnabled: enabled
        };
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage(msg);
        }
        const reg = swRegistration || await navigator.serviceWorker.ready.catch(() => null) || await navigator.serviceWorker.getRegistration().catch(() => null);
        if (reg && reg.active) {
            reg.active.postMessage(msg);
        }
    } catch (_) {}
}

const pendingSystemNotifications: Array<{ title: string; options: any }> = [];

function toAbsoluteUrl(rawUrl?: string): string {
    if (!rawUrl) return '';
    try {
        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:')) {
            return rawUrl;
        }
        if (typeof window !== 'undefined' && window.location && window.location.origin) {
            return new URL(rawUrl, window.location.origin).href;
        }
    } catch (_) {}
    return rawUrl;
}

function isRunningInApkWebView(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (w.WebToApk || w.AppMint || w.appmintNative || w.Android || w.AndroidInterface) {
        return true;
    }
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
    return /; wv\)|WebToApk|AppMint|Web2App/i.test(ua);
}

function flushPendingSystemNotifications() {
    if (pendingSystemNotifications.length === 0) return;
    const items = pendingSystemNotifications.splice(0, pendingSystemNotifications.length);
    for (const item of items) {
        triggerSystemNotification(item.title, { ...item.options, skipFcmPush: true }).catch(() => {});
    }
}

// System Notification Helper (Displays push notification outside phone / system notification bar)
async function triggerSystemNotification(title: string, options: any = {}): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (!isNotificationsEnabled()) return false;

    const appIcon = toAbsoluteUrl("/assets/icon-192.png");
    const logoUrl = toAbsoluteUrl(options.icon || options.imageUrl || appSettings?.logoUrl || "/assets/icon-192.png");
    const cleanTag = String(options.tag || ("erena_" + Date.now() + "_" + Math.floor(Math.random() * 1000)));

    let displayTitle = title ? title.trim() : 'Erena Esports';
    if (!displayTitle || displayTitle.toLowerCase() === 'new' || displayTitle.toLowerCase() === 'notification' || displayTitle.toLowerCase() === 'tournament announcement' || displayTitle.toLowerCase() === 'tournament notification') {
        displayTitle = 'Erena Esports 🏆';
    } else if (!displayTitle.toLowerCase().includes('erena')) {
        displayTitle = `Erena Esports - ${displayTitle}`;
    }

    const bodyText = options.body || options.message || options.text || "New tournament update available!";
    const rawBanner = options.imageUrl || options.image || undefined;
    const bannerImage = rawBanner ? toAbsoluteUrl(rawBanner) : undefined;

    // Dispatch via Firebase Cloud Messaging HTTP v1 API if token is available and not skipped
    if (!options.skipFcmPush) {
        try {
            const fcmToken = userProfile?.fcmToken || localStorage.getItem('erena_fcm_token');
            if (fcmToken) {
                sendFcmHttpV1Push({
                    token: fcmToken,
                    title: displayTitle,
                    body: bodyText,
                    icon: logoUrl,
                    image: bannerImage,
                    tag: cleanTag,
                    url: options.data?.url || "/"
                }).catch(() => {});
            }
        } catch (_) {}
    }

    const w = window as any;
    let shownNatively = false;

    // 1. Primary Native Bridge for AppMint / WebToApk APK builds
    try {
        const bridge = w.WebToApk;
        if (bridge) {
            let apkPerm = 'granted';
            if (typeof bridge.getNotificationPermission === 'function') {
                apkPerm = bridge.getNotificationPermission() || 'default';
            } else if ('Notification' in window) {
                apkPerm = Notification.permission;
            }

            if (apkPerm !== 'granted') {
                if (typeof bridge.requestNotificationPermission === 'function') {
                    try { bridge.requestNotificationPermission(); } catch (_) {}
                }
                if ('Notification' in window && typeof Notification.requestPermission === 'function') {
                    try {
                        const resPerm = await Notification.requestPermission();
                        apkPerm = resPerm;
                    } catch (_) {}
                }
            }

            if (typeof bridge.notify === 'function') {
                const payloadObj: any = {
                    title: displayTitle,
                    body: bodyText,
                    bigText: bodyText,
                    channel: 'urgent',
                    largeIcon: logoUrl,
                    color: '#FACC15',
                    tag: cleanTag
                };
                if (bannerImage && bannerImage.startsWith('http')) {
                    payloadObj.image = bannerImage;
                }
                const ok = bridge.notify(JSON.stringify(payloadObj));
                if (ok !== false) {
                    shownNatively = true;
                }
            }

            if (!shownNatively && typeof bridge.showNotification === 'function') {
                const ok = bridge.showNotification(displayTitle, bodyText, logoUrl, cleanTag);
                if (ok !== false) {
                    shownNatively = true;
                }
            }

            if (apkPerm !== 'granted') {
                if (!pendingSystemNotifications.some(p => p.options?.tag === cleanTag)) {
                    pendingSystemNotifications.push({ title: displayTitle, options: { ...options, tag: cleanTag, skipFcmPush: true } });
                }
            }
        }
    } catch (apkErr) {
        console.warn("[APK Bridge] WebToApk notification error:", apkErr);
    }

    // 2. Support other Android WebView / APK native notification bridges if available
    if (!shownNatively) {
        try {
            if (w.appmintNative && typeof w.appmintNative.notify === 'function') {
                w.appmintNative.notify({
                    title: displayTitle,
                    body: bodyText,
                    largeIcon: logoUrl,
                    image: bannerImage,
                    channel: 'urgent',
                    tag: cleanTag
                });
                shownNatively = true;
            } else if (w.Android && typeof w.Android.showNotification === 'function') {
                w.Android.showNotification(displayTitle, bodyText);
                shownNatively = true;
            } else if (w.AndroidInterface && typeof w.AndroidInterface.showNotification === 'function') {
                w.AndroidInterface.showNotification(displayTitle, bodyText);
                shownNatively = true;
            }
        } catch (_) {}
    }

    if (shownNatively) {
        return true;
    }

    if (!("Notification" in window)) return false;

    let perm = Notification.permission;
    if (perm === "default") {
        if (!pendingSystemNotifications.some(p => p.options?.tag === cleanTag)) {
            pendingSystemNotifications.push({ title: displayTitle, options: { ...options, tag: cleanTag, skipFcmPush: true } });
        }
        try {
            perm = await Notification.requestPermission();
        } catch (_) {}
    }

    if (perm !== "granted") {
        return false;
    }

    let shown = false;
    const isApkWebView = isRunningInApkWebView();

    // 3. In APK / Android WebView over HTTPS, `new Notification()` is polyfilled to Android's native NotificationManager,
    // whereas ServiceWorkerRegistration.showNotification is ignored by Android WebView.
    if (isApkWebView) {
        try {
            const notifOpts: any = {
                body: bodyText,
                icon: logoUrl,
                badge: appIcon,
                tag: cleanTag,
                data: options.data || { url: "/" }
            };
            if (bannerImage) notifOpts.image = bannerImage;
            new Notification(displayTitle, notifOpts);
            shown = true;
        } catch (e) {
            console.warn("[APK] Direct Notification constructor fallback error:", e);
        }
    }

    const swNotifOptions: any = {
        body: bodyText,
        icon: logoUrl,
        badge: appIcon,
        image: bannerImage,
        vibrate: [300, 100, 300, 100, 300],
        tag: cleanTag,
        renotify: true,
        data: options.data || { url: "/" },
        actions: [
            { action: "open_tournament", title: "🎮 View Tournament" }
        ]
    };

    // 4. Post to Service Worker registration (Primary for Chrome / Browser PWA)
    if (!shown && "serviceWorker" in navigator) {
        try {
            let reg = swRegistration;
            if (!reg) {
                reg = await navigator.serviceWorker.getRegistration().catch(() => null);
                if (!reg && navigator.serviceWorker.ready) {
                    reg = await Promise.race([
                        navigator.serviceWorker.ready,
                        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
                    ]);
                }
                if (reg) swRegistration = reg;
            }

            if (reg && typeof reg.showNotification === "function") {
                await reg.showNotification(displayTitle, swNotifOptions);
                shown = true;
            }
        } catch (swErr) {
            console.warn("[FCM] SW showNotification error:", swErr);
        }

        // 5. Fallback to Service Worker controller postMessage if reg.showNotification didn't run
        if (!shown) {
            try {
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: "SHOW_NOTIFICATION",
                        title: displayTitle,
                        options: swNotifOptions
                    });
                    shown = true;
                }
            } catch (msgErr) {
                console.warn("[FCM] SW postMessage error:", msgErr);
            }
        }
    }

    // 6. Final fallback to native window Notification constructor
    if (!shown) {
        try {
            const notifOpts: any = {
                body: bodyText,
                icon: logoUrl,
                badge: appIcon,
                tag: cleanTag,
                data: options.data || { url: "/" }
            };
            if (bannerImage) notifOpts.image = bannerImage;
            new Notification(displayTitle, notifOpts);
            shown = true;
        } catch (e) {
            console.warn("[FCM] Direct Notification API constructor not supported in this context:", e);
        }
    }

    return shown;
}

async function initFirebaseMessaging() {
    if (typeof window === 'undefined') return;

    // 0. If running inside AppMint / WebToApk APK, request notification permission & listen for native push events
    try {
        const w = window as any;
        if (w.WebToApk) {
            if (typeof w.WebToApk.requestNotificationPermission === 'function') {
                const perm = typeof w.WebToApk.getNotificationPermission === 'function'
                    ? w.WebToApk.getNotificationPermission()
                    : 'default';
                if (perm !== 'granted') {
                    w.WebToApk.requestNotificationPermission();
                }
            }
            if (typeof w.WebToApk.getPushInbox === 'function') {
                try {
                    const rawInbox = w.WebToApk.getPushInbox();
                    const inbox = typeof rawInbox === 'string' ? JSON.parse(rawInbox) : rawInbox;
                    if (Array.isArray(inbox)) {
                        for (const item of inbox) {
                            if (item && item.id) {
                                const idStr = String(item.id);
                                if (idStr.startsWith('global_')) {
                                    localStorage.setItem(`erena_global_sys_pushed_${idStr.slice(7)}`, '1');
                                } else if (idStr.startsWith('notif_')) {
                                    localStorage.setItem(`erena_sys_pushed_${idStr.slice(6)}`, '1');
                                }
                            }
                        }
                    }
                } catch (_) {}
            }
            window.addEventListener('appmint:push', (e: any) => {
                const d = e?.detail;
                if (d && d.message && d.message.id) {
                    const idStr = String(d.message.id);
                    try {
                        if (idStr.startsWith('global_')) {
                            localStorage.setItem(`erena_global_sys_pushed_${idStr.slice(7)}`, '1');
                        } else if (idStr.startsWith('notif_')) {
                            localStorage.setItem(`erena_sys_pushed_${idStr.slice(6)}`, '1');
                        }
                    } catch (_) {}
                }
                if (d && d.type === 'received' && d.message && !d.presented) {
                    triggerSystemNotification(d.message.title || 'Erena Esports 🏆', {
                        body: d.message.body || 'New tournament update!',
                        imageUrl: d.message.imageUrl,
                        tag: `appmint_${d.message.id || Date.now()}`,
                        skipFcmPush: true
                    });
                }
                loadAndDisplayNotifications();
            });
        }
    } catch (_) {}

    // 1. Register background Service Worker (/firebase-messaging-sw.js)
    if ('serviceWorker' in navigator) {
        try {
            swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/'
            });
            console.log('[FCM] Background Service Worker registered. Scope:', swRegistration.scope);
            
            if (navigator.serviceWorker.ready) {
                swRegistration = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise<ServiceWorkerRegistration>((resolve) => setTimeout(() => resolve(swRegistration!), 2000))
                ]);
            }
            if (currentUser) {
                syncServiceWorkerUserState(currentUser.uid, isNotificationsEnabled());
            }
        } catch (swErr) {
            console.warn('[FCM] Service Worker registration not available in this environment:', swErr);
        }
    }

    // 2. Initialize Firebase Messaging if supported by browser/device
    try {
        const supported = await isMessagingSupported().catch(() => false);
        if (supported && app) {
            messaging = getMessaging(app);
            console.log('[FCM] Firebase Messaging initialized successfully.');

            // Listen for foreground FCM push messages
            onMessage(messaging, (payload: any) => {
                console.log('[FCM] Push Message received in foreground:', payload);
                const title = payload.notification?.title || payload.data?.title || payload.title || 'Tournament Alert';
                const body = payload.notification?.body || payload.data?.body || payload.data?.message || payload.body || 'New notification received';
                const icon = payload.notification?.icon || payload.data?.icon || payload.icon;

                triggerSystemNotification(title, {
                    body: body,
                    icon: icon,
                    data: payload.data,
                    tag: payload.data?.tag || payload.notification?.tag,
                    skipFcmPush: true
                });

                loadAndDisplayNotifications();
            });
        }
    } catch (msgErr) {
        console.warn('[FCM] Firebase Messaging support check error:', msgErr);
    }
}

// Request permission and sync FCM Token to user account
async function setupPushNotifications(forcePrompt = false): Promise<string | null> {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const w = window as any;
        if (w.WebToApk && typeof w.WebToApk.requestNotificationPermission === 'function') {
            try {
                const apkPerm = typeof w.WebToApk.getNotificationPermission === 'function'
                    ? w.WebToApk.getNotificationPermission()
                    : 'default';
                if (apkPerm !== 'granted' && forcePrompt) {
                    w.WebToApk.requestNotificationPermission();
                }
            } catch (_) {}
        }

        if ('serviceWorker' in navigator && !swRegistration) {
            swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' }).catch(() => null) ||
                             await navigator.serviceWorker.getRegistration().catch(() => null);
        }

        if (currentUser) {
            syncServiceWorkerUserState(currentUser.uid, isNotificationsEnabled());
        }

        if (!('Notification' in window)) {
            flushPendingSystemNotifications();
            return null;
        }

        let perm = Notification.permission;
        if (perm === 'default' && forcePrompt) {
            try {
                perm = await Notification.requestPermission();
            } catch (_) {}
        }

        if (perm === 'granted') {
            flushPendingSystemNotifications();
        } else {
            return null;
        }

        if (elements.notificationSwitch && isNotificationsEnabled()) {
            elements.notificationSwitch.checked = true;
        }

        if (!messaging) {
            const supported = await isMessagingSupported().catch(() => false);
            if (supported && app) {
                messaging = getMessaging(app);
            }
        }

        if (messaging) {
            try {
                const token = await getToken(messaging, {
                    serviceWorkerRegistration: swRegistration || undefined
                });

                if (token) {
                    try {
                        localStorage.setItem('erena_fcm_token', token);
                    } catch (_) {}
                    console.log('[FCM] Push Notification Token acquired:', token);
                    if (currentUser) {
                        const enabled = isNotificationsEnabled();
                        await update(ref(db, `users/${currentUser.uid}`), {
                            fcmToken: token,
                            notificationsEnabled: enabled,
                            fcmTokenUpdatedAt: serverTimestamp()
                        }).catch(() => {});
                        registerUserFcmToken(currentUser.uid, token).catch(() => {});
                    }
                    return token;
                }
            } catch (tokenErr) {
                console.warn('[FCM] getToken error (service worker may still handle background pushes):', tokenErr);
            }
        }
    } catch (err) {
        console.error('[FCM] setupPushNotifications failed:', err);
    }
    return null;
}

const getElement = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const querySel = <T extends HTMLElement = HTMLElement>(selector: string): T | null => document.querySelector(selector);
const querySelAll = <T extends HTMLElement = HTMLElement>(selector: string): NodeListOf<T> => document.querySelectorAll(selector);

const elements = {
    sections: querySelAll<HTMLElement>('.section'),
    bottomNavItems: querySelAll<HTMLButtonElement>('.bottom-nav .nav-item'),
    globalLoader: getElement('globalLoaderEl'),
    headerBackBtn: getElement<HTMLButtonElement>('headerBackBtnEl'),
    headerTitleContainer: getElement('headerTitleContainerEl'),
    headerGameTitle: getElement('headerGameTitleEl'),
    headerWalletChip: getElement<HTMLButtonElement>('headerWalletChipEl'),
    headerChipBalance: getElement('headerChipBalanceEl'),
    headerUserGreeting: getElement('headerUserGreetingEl'),
    appLogo: getElement<HTMLImageElement>('appLogoEl'),
    notificationBtn: getElement<HTMLButtonElement>('notificationBtnEl'),
    notificationBadge: querySel<HTMLElement>('.notification-badge'),

    // Login & Signup
    loginSection: getElement('login-section'),
    tabSwitchLoginBtn: getElement<HTMLButtonElement>('tabSwitchLoginBtn'),
    tabSwitchSignupBtn: getElement<HTMLButtonElement>('tabSwitchSignupBtn'),
    emailLoginForm: getElement<HTMLFormElement>('emailLoginForm'),
    loginEmailInput: getElement<HTMLInputElement>('loginEmailInputEl'),
    loginPasswordInput: getElement<HTMLInputElement>('loginPasswordInputEl'),
    loginEmailBtn: getElement<HTMLButtonElement>('loginEmailBtnEl'),
    showSignupToggleBtn: getElement<HTMLButtonElement>('showSignupToggleBtnEl'),
    loginStatusMessage: getElement('loginStatusMessageEl'),
    forgotPasswordLink: getElement<HTMLAnchorElement>('forgotPasswordLinkEl'),

    emailSignupForm: getElement<HTMLFormElement>('emailSignupForm'),
    signupNameInput: getElement<HTMLInputElement>('signupNameInputEl'),
    signupEmailInput: getElement<HTMLInputElement>('signupEmailInputEl'),
    signupPasswordInput: getElement<HTMLInputElement>('signupPasswordInputEl'),
    signupReferralCodeInput: getElement<HTMLInputElement>('signupReferralCodeInputEl'),
    signupEmailBtn: getElement<HTMLButtonElement>('signupEmailBtnEl'),
    showLoginToggleBtn: getElement<HTMLButtonElement>('showLoginToggleBtnEl'),
    signupStatusMessage: getElement('signupStatusMessageEl'),

    // Home
    homeSection: getElement('home-section'),
    promotionSlider: getElement('promotionSliderEl'),
    gamesList: getElement('gamesListEl'),
    myContestsList: getElement('myContestsListEl'),
    noContestsMessage: getElement('noContestsMessageEl'),

    // Tournaments
    tournamentsSection: getElement('tournaments-section'),
    tournamentsListContainer: getElement('tournamentsListContainerEl'),
    noTournamentsMessage: getElement('noTournamentsMessageEl'),
    tournamentTabs: querySelAll<HTMLButtonElement>('.tournament-tabs .tab-item'),

    // Wallet
    walletSection: getElement('wallet-section'),
    walletTotalBalance: getElement('walletTotalBalanceEl'),
    walletDepositCash: getElement('walletDepositCashEl'),
    depositCashAddNowBtn: getElement<HTMLButtonElement>('depositCashAddNowBtnEl'),
    walletWinningCash: getElement('walletWinningCashEl'),
    walletBonusCash: getElement('walletBonusCashEl'),
    allTransactionsBtn: getElement<HTMLButtonElement>('allTransactionsBtnEl'),
    withdrawBtn: getElement<HTMLButtonElement>('withdrawBtnEl'),
    addAmountWalletBtn: getElement<HTMLButtonElement>('addAmountWalletBtnEl'),
    recentTransactionsList: getElement('recentTransactionsListEl'),
    noTransactionsMessage: getElement('noTransactionsMessageEl'),

    // Earnings
    earningsSection: getElement('earnings-section'),
    earningsTotal: getElement('earningsTotalEl'),
    earningsReferral: getElement('earningsReferralEl'),
    viewEarningsHistoryBtn: getElement<HTMLButtonElement>('viewEarningsHistoryBtn'),

    // Leaderboard
    leaderboardSection: getElement('leaderboard-section'),
    leaderboardListEl: getElement('leaderboardListEl'),
    noLeaderboardMessageEl: getElement('noLeaderboardMessageEl'),
    tabTopPlayersBtn: getElement<HTMLButtonElement>('tabTopPlayersBtn'),
    tabTopReferralsBtn: getElement<HTMLButtonElement>('tabTopReferralsBtn'),
    referralPrizeBanner: getElement('referralPrizeBanner'),
    leaderboardSectionTitle: getElement('leaderboardSectionTitle'),

    // Leaderboard Profile & Like Modal
    leaderboardUserProfileModalEl: getElement('leaderboardUserProfileModalEl'),
    leaderboardUserProfileModalInstance: getElement('leaderboardUserProfileModalEl') ? new bootstrap.Modal(getElement('leaderboardUserProfileModalEl')) : null,
    lbModalAvatar: getElement<HTMLImageElement>('lbModalAvatarEl'),
    lbModalVipBadge: getElement('lbModalVipBadge'),
    lbModalName: getElement('lbModalNameEl'),
    lbModalRank: getElement('lbModalRankEl'),
    lbModalBio: getElement('lbModalBioEl'),
    lbModalBioContainer: getElement('lbModalBioContainer'),
    lbModalFavGun: getElement('lbModalFavGunEl'),
    lbModalFavGunContainer: getElement('lbModalFavGunContainer'),
    lbModalInstagramBtn: getElement<HTMLAnchorElement>('lbModalInstagramBtn'),
    lbModalYoutubeBtn: getElement<HTMLAnchorElement>('lbModalYoutubeBtn'),
    lbModalTotalWinning: getElement('lbModalTotalWinningEl'),
    lbModalMatches: getElement('lbModalMatchesEl'),
    lbModalWon: getElement('lbModalWonEl'),
    lbModalWinRate: getElement('lbModalWinRateEl'),
    lbModalLikeBtn: getElement<HTMLButtonElement>('lbModalLikeBtnEl'),
    lbModalHeartIcon: getElement('lbModalHeartIcon'),
    lbModalLikeText: getElement('lbModalLikeText'),
    lbModalLikeCount: getElement('lbModalLikeCount'),
    lbModalLikeStatus: getElement('lbModalLikeStatus'),
    lbModalContent: getElement('lbModalContentEl'),
    lbModalVipBanner: getElement('lbModalVipBanner'),
    lbHeartBurstContainer: getElement('lbHeartBurstContainer'),
    lbModalFriendActionContainer: getElement('lbModalFriendActionContainer'),
    lbModalFriendStatusAlert: getElement('lbModalFriendStatusAlert'),

    // Profile
    profileSection: getElement('profile-section'),
    profileHeaderCard: getElement('profileHeaderCardEl'),
    profileVipRibbon: getElement('profileVipRibbonEl'),
    profileAvatar: getElement<HTMLImageElement>('profileAvatarEl'),
    profileVipCrownBadge: getElement('profileVipCrownBadge'),
    profileName: getElement('profileNameEl'),
    profileEmail: getElement('profileEmailEl'),
    profileBioDisplay: getElement('profileBioDisplayEl'),
    profileFavGunDisplay: getElement('profileFavGunDisplayEl'),
    profileFavGunBadge: getElement('profileFavGunBadgeEl'),
    profileInstagramLink: getElement<HTMLAnchorElement>('profileInstagramLinkEl'),
    profileYoutubeLink: getElement<HTMLAnchorElement>('profileYoutubeLinkEl'),
    editProfileFullBtn: getElement<HTMLButtonElement>('editProfileFullBtnEl'),
    profileTotalMatches: getElement('profileTotalMatchesEl'),
    profileWonMatches: getElement('profileWonMatchesEl'),
    profileWinRate: getElement('profileWinRateEl'),
    profileTotalEarnings: getElement('profileTotalEarningsEl'),
    profileLikesCountValue: getElement('profileLikesCountValue'),
    logoutProfileBtn: getElement<HTMLButtonElement>('logoutProfileBtnEl'),
    policyLinks: querySelAll<HTMLElement>('.profile-links [data-policy]'),
    notificationSwitch: getElement<HTMLInputElement>('notificationSwitchEl'),

    // Buy Premium & Subscription
    buyPremiumBtn: getElement<HTMLAnchorElement>('buyPremiumBtnEl'),
    premiumSubscriptionModalInstance: getElement('premiumSubscriptionModalEl') ? new bootstrap.Modal(getElement('premiumSubscriptionModalEl')) : null,
    premiumModalUserBalance: getElement('premiumModalUserBalanceEl'),
    premiumModalInsufficientBadge: getElement('premiumModalInsufficientBadge'),
    premiumFfUidInput: getElement<HTMLInputElement>('premiumFfUidInputEl'),
    premiumThumbnailImg: getElement<HTMLImageElement>('premiumThumbnailImgEl'),
    alreadySubscribedBanner: getElement('alreadySubscribedBannerEl'),
    vipActiveUidDisplay: getElement('vipActiveUidDisplay'),
    vipRareBundleCodeDisplay: getElement('vipRareBundleCodeDisplay'),
    premiumStatusMessage: getElement('premiumStatusMessageEl'),
    confirmBuyPremiumBtn: getElement<HTMLButtonElement>('confirmBuyPremiumBtnEl'),

    // Recharge Flow
    rechargeSection: getElement('recharge-section'),
    rechargeStep1: getElement('recharge-step-1-amount'),
    rechargeStep2: getElement('recharge-step-2-method'),
    rechargeStep3: getElement('recharge-step-3-payment'),
    rechargeBalanceDisplay: getElement('rechargeBalanceDisplay'),
    rechargeAmountInput: getElement<HTMLInputElement>('rechargeAmountInput'),
    rechargePresetBtns: querySelAll<HTMLButtonElement>('.amount-preset-btn'),
    rechargeStep1Status: getElement('rechargeStep1Status'),
    goToStep2Btn: getElement<HTMLButtonElement>('goToStep2Btn'),
    rechargeAmountConfirm: getElement('rechargeAmountConfirm'),
    paymentOptionCards: querySelAll<HTMLElement>('.payment-option-card'),
    rechargeStep2Status: getElement('rechargeStep2Status'),
    goToStep3Btn: getElement<HTMLButtonElement>('goToStep3Btn'),
    rechargeFinalAmount: getElement('rechargeFinalAmount'),
    rechargePaymentMode: getElement('rechargePaymentMode'),
    rechargeUpiId: getElement('rechargeUpiId'),
    rechargeQrCodeImg: getElement<HTMLImageElement>('rechargeQrCodeImg'),
    rechargeCopyAmtBtn: getElement<HTMLButtonElement>('rechargeCopyAmtBtn'),
    rechargeCopyUpiBtn: getElement<HTMLButtonElement>('rechargeCopyUpiBtn'),
    rechargeUtrInput: getElement<HTMLInputElement>('rechargeUtrInput'),
    rechargeStep3Status: getElement('rechargeStep3Status'),
    rechargeCancelBtn: getElement<HTMLButtonElement>('rechargeCancelBtn'),
    rechargeSubmitBtn: getElement<HTMLButtonElement>('rechargeSubmitBtn'),

    // Modals
    policyModalInstance: getElement('policyModalEl') ? new bootstrap.Modal(getElement('policyModalEl')) : null,
    policyModalTitle: getElement('policyModalTitleEl'),
    policyModalBody: getElement('policyModalBodyEl'),
    addAmountModalInstance: getElement('addAmountModalEl') ? new bootstrap.Modal(getElement('addAmountModalEl')) : null,
    modalUpiNumber: getElement('modalUpiNumberEl'),

    withdrawModalInstance: getElement('withdrawModalEl') ? new bootstrap.Modal(getElement('withdrawModalEl')) : null,
    withdrawModalBalance: getElement('withdrawModalBalanceEl'),
    withdrawAmountInput: getElement<HTMLInputElement>('withdrawAmountInputEl'),
    withdrawMethodInput: getElement<HTMLInputElement>('withdrawMethodInputEl'),
    minWithdrawAmount: getElement('minWithdrawAmountEl'),
    withdrawStatusMessage: getElement('withdrawStatusMessageEl'),
    submitWithdrawRequestBtn: getElement<HTMLButtonElement>('submitWithdrawRequestBtnEl'),

    matchDetailsModalInstance: getElement('matchDetailsModalEl') ? new bootstrap.Modal(getElement('matchDetailsModalEl')) : null,
    matchDetailsModalTitle: getElement('matchDetailsModalTitleEl'),
    matchDetailsModalBody: getElement('matchDetailsModalBodyEl'),

    idPasswordModalInstance: getElement('idPasswordModalEl') ? new bootstrap.Modal(getElement('idPasswordModalEl')) : null,
    roomIdDisplay: getElement('roomIdDisplayEl'),
    roomPasswordDisplay: getElement('roomPasswordDisplayEl'),

    joinTournamentDetailsModalInstance: getElement('joinTournamentDetailsModal') ? new bootstrap.Modal(getElement('joinTournamentDetailsModal')) : null,
    joinFeeDisplayEl: getElement('joinFeeDisplayEl'),
    joinTournamentIdInput: getElement<HTMLInputElement>('joinTournamentIdInput'),
    joinTournamentFeeInput: getElement<HTMLInputElement>('joinTournamentFeeInput'),
    joinTournamentModeInput: getElement<HTMLInputElement>('joinTournamentModeInput'),
    joinUsernameInput: getElement<HTMLInputElement>('joinUsernameInput'),
    joinGameUidInput: getElement<HTMLInputElement>('joinGameUidInput'),
    joinDuoFieldsContainer: getElement('joinDuoFieldsContainer'),
    joinTeammateUsernameInput: getElement<HTMLInputElement>('joinTeammateUsernameInput'),
    joinTeammateGameUidInput: getElement<HTMLInputElement>('joinTeammateGameUidInput'),
    joinTournamentStatusMessage: getElement('joinTournamentStatusMessageEl'),
    confirmJoinBtn: getElement<HTMLButtonElement>('confirmJoinBtn'),

    notificationsModalInstance: getElement('notificationsModalEl') ? new bootstrap.Modal(getElement('notificationsModalEl')) : null,
    notificationsListEl: getElement('notificationsListEl'),
    notificationsEmptyMsgEl: getElement('notificationsEmptyMsgEl'),
    clearAllNotificationsBtn: getElement<HTMLButtonElement>('clearAllNotificationsBtnEl'),

    // Support & FAQ
    contactUsBtn: getElement('contactUsBtnEl'),
    faqSupportModalInstance: getElement('faqSupportModalEl') ? new bootstrap.Modal(getElement('faqSupportModalEl')) : null,
    whatsappSupportBtn: getElement('whatsappSupportBtnEl'),

    // YouTube Promo
    youtubePromoSection: getElement('youtube-promo-section'),
    promoVideoLink: getElement<HTMLInputElement>('promoVideoLink'),
    submitPromoLinkBtn: getElement<HTMLButtonElement>('submitPromoLinkBtn'),
    promoStatusMessage: getElement('promoStatusMessage'),

    // Edit Profile
    editNameBtnEl: getElement<HTMLButtonElement>('editNameBtnEl'),
    editNameModalInstance: getElement('editNameModal') ? new bootstrap.Modal(getElement('editNameModal')) : null,
    openChooseAvatarModalBtn: getElement('openChooseAvatarModalBtn'),
    editProfileAvatarPreviewEl: getElement<HTMLImageElement>('editProfileAvatarPreviewEl'),
    editProfileAvatarSubtextEl: getElement('editProfileAvatarSubtextEl'),
    chooseAvatarModalInstance: getElement('chooseAvatarModalEl') ? new bootstrap.Modal(getElement('chooseAvatarModalEl')) : null,
    avatarPickerGridEl: getElement('avatarPickerGridEl'),
    confirmChooseAvatarBtnEl: getElement<HTMLButtonElement>('confirmChooseAvatarBtnEl'),
    editNameInput: getElement<HTMLInputElement>('editNameInput'),
    editBioInput: getElement<HTMLTextAreaElement>('editBioInput'),
    editFavGunInput: getElement<HTMLInputElement>('editFavGunInput'),
    editInstagramInput: getElement<HTMLInputElement>('editInstagramInput'),
    editYoutubeInput: getElement<HTMLInputElement>('editYoutubeInput'),
    editNameStatusMessage: getElement('editNameStatusMessage'),
    saveNameChangeBtn: getElement<HTMLButtonElement>('saveNameChangeBtn'),

    // Match History
    matchHistoryBtn: getElement('matchHistoryBtn'),
    matchHistoryModalInstance: getElement('matchHistoryModal') ? new bootstrap.Modal(getElement('matchHistoryModal')) : null,
    matchHistoryBodyEl: getElement('matchHistoryBodyEl'),

    // Redeem Gift Card System
    redeemGiftCardBtn: getElement<HTMLAnchorElement>('redeemGiftCardBtn'),
    redeemGiftCardModalInstance: getElement('redeemGiftCardModalEl') ? new bootstrap.Modal(getElement('redeemGiftCardModalEl')) : null,
    redeemTabBuyBtn: getElement<HTMLButtonElement>('redeemTabBuyBtn'),
    redeemTabHistoryBtn: getElement<HTMLButtonElement>('redeemTabHistoryBtn'),
    redeemHistoryCountBadge: getElement('redeemHistoryCountBadge'),
    redeemBuyView: getElement('redeemBuyView'),
    redeemHistoryView: getElement('redeemHistoryView'),
    redeemModalWalletBalance: getElement('redeemModalWalletBalance'),
    redeemBalanceStatusBadge: getElement('redeemBalanceStatusBadge'),
    brandCardGooglePlay: getElement('brandCardGooglePlay'),
    brandCardAmazon: getElement('brandCardAmazon'),
    redeemPresetBtns: querySelAll<HTMLButtonElement>('.redeem-preset-btn'),
    redeemCustomAmountInput: getElement<HTMLInputElement>('redeemCustomAmountInput'),
    redeemStatusMessage: getElement('redeemStatusMessage'),
    submitRedeemBtn: getElement<HTMLButtonElement>('submitRedeemBtn'),
    refreshRedeemHistoryBtn: getElement<HTMLButtonElement>('refreshRedeemHistoryBtn'),
    redeemHistoryCardsContainer: getElement('redeemHistoryCardsContainer'),
    redeemHistoryEmptyMsg: getElement('redeemHistoryEmptyMsg'),
    goToBuyTabBtn: getElement<HTMLButtonElement>('goToBuyTabBtn'),

    // Chat
    tournamentChatModalInstance: getElement('tournamentChatModal') ? new bootstrap.Modal(getElement('tournamentChatModal')) : null,
    tournamentChatModalTitle: getElement('tournamentChatModalTitle'),
    chatMessagesEl: getElement('chatMessagesEl'),
    chatForm: getElement<HTMLFormElement>('chatForm'),
    chatMessageInput: getElement<HTMLInputElement>('chatMessageInput'),
    chatReplyContextEl: getElement('chatReplyContextEl'),
    replyToNameEl: getElement('replyToNameEl'),
    replyToMessageEl: getElement('replyToMessageEl'),
    cancelReplyBtn: getElement<HTMLButtonElement>('cancelReplyBtn'),

    // Friend System Menus & Badges
    messagesMenuBtn: getElement<HTMLAnchorElement>('messagesMenuBtn'),
    messagesUnreadBadge: getElement('messagesUnreadBadge'),
    friendsMenuBtn: getElement<HTMLAnchorElement>('friendsMenuBtn'),
    friendsCountBadge: getElement('friendsCountBadge'),
    friendRequestsMenuBtn: getElement<HTMLAnchorElement>('friendRequestsMenuBtn'),
    friendRequestsBadge: getElement('friendRequestsBadge'),

    // Messages Section
    messagesSection: getElement('messages-section'),
    messagesGoToFriendsBtn: getElement<HTMLButtonElement>('messagesGoToFriendsBtn'),
    conversationsSearchInput: getElement<HTMLInputElement>('conversationsSearchInput'),
    conversationsListContainerEl: getElement('conversationsListContainerEl'),
    noConversationsMessageEl: getElement('noConversationsMessageEl'),
    conversationsFindFriendsBtn: getElement<HTMLButtonElement>('conversationsFindFriendsBtn'),

    // Friends Section
    friendsSection: getElement('friends-section'),
    friendsGoToRequestsBtn: getElement<HTMLButtonElement>('friendsGoToRequestsBtn'),
    friendsSectionRequestsBadge: getElement('friendsSectionRequestsBadge'),
    friendsSearchInput: getElement<HTMLInputElement>('friendsSearchInput'),
    friendsListContainerEl: getElement('friendsListContainerEl'),
    noFriendsMessageEl: getElement('noFriendsMessageEl'),
    friendsBrowseLeaderboardBtn: getElement<HTMLButtonElement>('friendsBrowseLeaderboardBtn'),

    // Friend Requests Section
    friendRequestsSection: getElement('friend-requests-section'),
    requestsGoToFriendsBtn: getElement<HTMLButtonElement>('requestsGoToFriendsBtn'),
    friendRequestsListContainerEl: getElement('friendRequestsListContainerEl'),
    noFriendRequestsMessageEl: getElement('noFriendRequestsMessageEl'),

    // Personal Chat Section (Full-Screen)
    personalChatSection: getElement('personal-chat-section'),
    personalChatBackBtn: getElement<HTMLButtonElement>('personalChatBackBtn'),
    personalChatAvatarEl: getElement<HTMLImageElement>('personalChatAvatarEl'),
    personalChatOnlineDot: getElement('personalChatOnlineDot'),
    personalChatNameEl: getElement('personalChatNameEl'),
    personalChatStatusEl: getElement('personalChatStatusEl'),
    personalChatViewProfileBtn: getElement<HTMLButtonElement>('personalChatViewProfileBtn'),
    personalChatMenuProfile: getElement<HTMLButtonElement>('personalChatMenuProfile'),
    personalChatMenuClear: getElement<HTMLButtonElement>('personalChatMenuClear'),
    personalChatMenuUnfriend: getElement<HTMLButtonElement>('personalChatMenuUnfriend'),
    personalChatMenuBlock: getElement<HTMLButtonElement>('personalChatMenuBlock'),
    personalChatBodyEl: getElement('personalChatBodyEl'),
    personalChatMessagesContainer: getElement('personalChatMessagesContainer'),
    personalChatTypingEl: getElement('personalChatTypingEl'),
    personalChatTypingText: getElement('personalChatTypingText'),
    personalChatBlockedBanner: getElement('personalChatBlockedBanner'),
    unblockUserBtn: getElement<HTMLAnchorElement>('unblockUserBtn'),
    personalChatFooterEl: getElement('personalChatFooterEl'),
    personalChatForm: getElement<HTMLFormElement>('personalChatForm'),
    personalChatInput: getElement<HTMLInputElement>('personalChatInput'),
    personalChatSendBtn: getElement<HTMLButtonElement>('personalChatSendBtn'),

    // Daily Login Streak, Mystery Box & Free Fire Rank System Elements
    profileRankShowcaseCard: getElement('profileRankShowcaseCardEl'),
    profileRankEmblemContainer: getElement('profileRankEmblemContainerEl'),
    profileRankTierTag: getElement('profileRankTierTagEl'),
    profileDailyStreakBadge: getElement('profileDailyStreakBadgeEl'),
    profileRankTitle: getElement('profileRankTitleEl'),
    profileRankNextHint: getElement('profileRankNextHintEl'),
    openAllRanksModalLink: getElement<HTMLAnchorElement>('openAllRanksModalLinkEl'),
    profileRankExpText: getElement('profileRankExpTextEl'),
    profileRankExpFill: getElement('profileRankExpFillEl'),
    openDailyLoginModalBtn: getElement<HTMLButtonElement>('openDailyLoginModalBtnEl'),
    profileDailyBoxMiniIcon: getElement('profileDailyBoxMiniIconEl'),
    profileDailyBoxSubtext: getElement('profileDailyBoxSubtextEl'),
    homeTopRankMiniText: getElement('homeTopRankMiniTextEl'),
    profileDailyBoxActionBadge: getElement('profileDailyBoxActionBadgeEl'),
    dailyLoginMenuLink: getElement<HTMLAnchorElement>('dailyLoginMenuLinkEl'),
    dailyLoginMenuBadge: getElement('dailyLoginMenuBadgeEl'),

    // Inspected Leaderboard Player Rank Showcase
    lbModalRankShowcaseCard: getElement('lbModalRankShowcaseCardEl'),
    lbModalRankEmblem: getElement('lbModalRankEmblemEl'),
    lbModalStreakBadge: getElement('lbModalStreakBadgeEl'),
    lbModalRankTitle: getElement('lbModalRankTitleEl'),
    lbModalRankExpText: getElement('lbModalRankExpTextEl'),
    lbModalRankExpFill: getElement('lbModalRankExpFillEl'),

    // Daily Login & Rank Modal
    dailyLoginRankModalEl: getElement('dailyLoginRankModalEl'),
    dailyLoginRankModalInstance: getElement('dailyLoginRankModalEl') ? new bootstrap.Modal(getElement('dailyLoginRankModalEl')) : null,
    dailyModalCurrentEmblem: getElement('dailyModalCurrentEmblemEl'),
    dailyModalCurrentRankName: getElement('dailyModalCurrentRankNameEl'),
    dailyModalCurrentExpBadge: getElement('dailyModalCurrentExpBadgeEl'),
    dailyModalStreakCount: getElement('dailyModalStreakCountEl'),
    dailyMysteryBoxStage: getElement('dailyMysteryBoxStageEl'),
    dailyGiftBurstContainer: getElement('dailyGiftBurstContainerEl'),
    dailyExpRewardPopContainer: getElement('dailyExpRewardPopContainerEl'),
    dailyMysteryBoxGraphic: getElement('dailyMysteryBoxGraphicEl'),
    dailyMysteryBoxStatusTitle: getElement('dailyMysteryBoxStatusTitleEl'),
    dailyMysteryBoxStatusDesc: getElement('dailyMysteryBoxStatusDescEl'),
    claimDailyBoxBtn: getElement<HTMLButtonElement>('claimDailyBoxBtnEl'),
    allRanksRoadmapGrid: getElement('allRanksRoadmapGridEl'),

    // Full-Screen Rank-Up Celebration Overlay
    ffRankUpCelebrationOverlay: getElement('ffRankUpCelebrationOverlayEl'),
    ffRankUpRays: getElement('ffRankUpRaysEl'),
    ffRankUpEmblemStage: getElement('ffRankUpEmblemStageEl'),
    ffRankUpChevrons: getElement('ffRankUpChevronsEl'),
    ffRankUpTitleText: getElement('ffRankUpTitleTextEl'),
    ffRankUpSubtitleText: getElement('ffRankUpSubtitleTextEl'),
    closeRankUpOverlayBtn: getElement<HTMLButtonElement>('closeRankUpOverlayBtnEl'),
};

let currentUser: User | null = null;
let userProfile: any = {};
let currentSectionId = 'login-section';
let dbListeners: Record<string, { path?: string; ref?: any; eventType?: any; func: any }> = {};
let swiperInstance: any = null;
let currentTournamentGameId: string | null = null;
let appSettings: any = {};
let tempReferralCode: string | null = null;
let currentRechargeData: { amount: number; paymentMethod: string | null; upiId: string | null } = { amount: 0, paymentMethod: null, upiId: null };
let currentChatListener: any = null;
let currentReply: any = null;
let currentLeaderboardTab: 'players' | 'referrals' = 'players';

// Personal Chat and Friend System State
let activePersonalChatFriend: any = null;
let activeChatListener: any = null;
let activeChatStatusListener: any = null;
let activeChatTypingListener: any = null;
let activeChatReadListener: any = null;
let activeChatBlockListener: any = null;
let activeChatRelListener: any = null;
let activeFriendLastReadTs = 0;
let activeChatClearedAt = 0;
let friendRelListeners: Record<string, { path: string; func: any }> = {};
const processedSignalKeys = new Set<string>();
const isValidFirebaseKey = (key: any): key is string =>
    typeof key === 'string' && key.trim().length > 0 && !/[.#$\[\]\/]/.test(key);
const getChatPairId = (uid1: any, uid2: any) => {
    const u1 = isValidFirebaseKey(uid1) ? uid1.trim() : '';
    const u2 = isValidFirebaseKey(uid2) ? uid2.trim() : '';
    if (!u1 || !u2) return '';
    return [u1, u2].sort().join('_');
};
let chatPreviousNavigation: {
    sectionId: string;
    wasModalOpen: boolean;
    inspectedUser: any;
    inspectedRank?: number;
} = { sectionId: 'home-section', wasModalOpen: false, inspectedUser: null };
let typingTimeout: any = null;
let currentFriendsCache: any[] = [];
let currentConversationsCache: any[] = [];
let currentInspectedUser: any = null;

const showLoader = (show: boolean) => {
    if (elements.globalLoader) elements.globalLoader.style.display = show ? 'flex' : 'none';
};

function showStatusMessage(element: HTMLElement | null, message: string, type = 'danger', autohide = true) {
    if (!element) return;
    element.innerHTML = message;
    element.className = `alert alert-${type} mt-3`;
    element.style.display = 'block';
    element.setAttribute('role', 'alert');
    if (autohide) {
        setTimeout(() => {
            if (element.innerHTML === message) element.style.display = 'none';
        }, 5000);
    }
}

function clearStatusMessage(element: HTMLElement | null) {
    if (!element) return;
    element.style.display = 'none';
    element.innerHTML = '';
    element.removeAttribute('role');
}

function copyToClipboard(targetSelectorOrText: string, isText = false) {
    let textToCopy = '';
    if (isText) {
        textToCopy = targetSelectorOrText;
    } else {
        if (!targetSelectorOrText) {
            alert('Copy target not defined.');
            return;
        }
        const targetElement = querySel(targetSelectorOrText);
        if (!targetElement) {
            alert('Element to copy from not found.');
            return;
        }
        textToCopy = targetElement.textContent || '';
    }
    if (!textToCopy || textToCopy === 'N/A' || textToCopy.includes('placeholder')) {
        alert('Nothing to copy.');
        return;
    }
    navigator.clipboard.writeText(textToCopy)
        .then(() => alert('Copied to clipboard: ' + textToCopy))
        .catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy.');
        });
}

function shareReferral(code: string) {
    if (!code || code === 'N/A') {
        alert('Referral code not available.');
        return;
    }
    const appName = appSettings?.appName || "Erena Esports";
    const defaultReferLink = "https://erenaesports.netlify.app";
    const rawLink = (appSettings && appSettings.referLink && appSettings.referLink.trim()) ? appSettings.referLink.trim() : defaultReferLink;
    const downloadLink = rawLink.includes('mediafire.com') ? defaultReferLink : rawLink;

    const shareText =
`🎮 *${appName} - Refer & Earn Program* 🏆

Refer Friends & Earn ₹10 Cash!
Use My Referral Code: *${code}*

📌 *Refer & Earn Rules:*
• Friend must signup using your referral code.
• Friend gets ₹10 Welcome Bonus.
• Get 10 rs when friend join 1 paid contest (Aapko ₹10 tab milega jab friend apna 1st Paid Contest successfully join karega).
• Top 10 referrers ko Leaderboard me Monthly Cash Prizes bhi milenge! 🏆

📲 *Download App Link 👇*
${downloadLink}`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    if (navigator.share) {
        navigator.share({
            title: `Join ${appName}!`,
            text: shareText
        }).catch(() => {
            window.open(whatsappUrl, '_blank');
        });
    } else {
        window.open(whatsappUrl, '_blank');
    }
}

function generateReferralCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function escapeHtml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSeconds < 60) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const formatFullDateTime = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
};

function getTimeRemaining(startTime: number) {
    if (!startTime) return 'TBA';
    const now = Date.now();
    const diff = startTime - now;
    if (diff <= 0) return 'Starting Soon';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    let o = '';
    if (days > 0) o += `${days}d `;
    if (hours > 0 || days > 0) o += `${hours}h `;
    o += `${minutes}m`;
    return o.trim() || 'Now';
}

const removePlaceholders = (parentElement: HTMLElement | null) => {
    if (!parentElement) return;
    parentElement.classList.remove('placeholder-glow');
    parentElement.querySelectorAll('.placeholder').forEach(el => el.remove());
};

function showSection(sectionId: string, backSection: string | null = null) {
    if (!auth || !sectionId || !elements.sections) return;
    const targetSection = getElement(sectionId);
    if (!targetSection) {
        showSection(currentUser ? 'home-section' : 'login-section');
        return;
    }
    const protectedSections = ['home-section', 'wallet-section', 'earnings-section', 'profile-section', 'tournaments-section', 'recharge-section', 'leaderboard-section', 'youtube-promo-section', 'messages-section', 'friends-section', 'friend-requests-section'];
    const isLoggedIn = !!currentUser;
    if (protectedSections.includes(sectionId) && !isLoggedIn) {
        showSection('login-section');
        return;
    }
    if (sectionId === 'login-section' && isLoggedIn) {
        showSection('home-section');
        return;
    }

    elements.sections.forEach(sec => sec.classList.remove('active'));
    targetSection.classList.add('active');
    currentSectionId = sectionId;
    updateHeaderForSection(sectionId, backSection);
    elements.bottomNavItems.forEach(item => item.classList.toggle('active', item.dataset.section === sectionId));

    if (sectionId !== 'leaderboard-section' && dbListeners['leaderboardUsers']) {
        try {
            if (typeof dbListeners['leaderboardUsers'].func === 'function') {
                dbListeners['leaderboardUsers'].func();
            }
            off(ref(db, 'users'), 'value', dbListeners['leaderboardUsers'].func);
        } catch (e) {}
        delete dbListeners['leaderboardUsers'];
    }

    switch (sectionId) {
        case 'home-section':
            loadHomePageData();
            break;
        case 'wallet-section':
            loadWalletData();
            break;
        case 'profile-section':
            loadProfileData();
            break;
        case 'earnings-section':
            loadEarningsData();
            break;
        case 'leaderboard-section':
            loadLeaderboardData();
            break;
        case 'messages-section':
            loadConversationsData();
            break;
        case 'friends-section':
            loadFriendsData();
            break;
        case 'friend-requests-section':
            loadFriendRequestsData();
            break;
        case 'recharge-section':
            break;
        case 'tournaments-section':
            if (currentTournamentGameId) {
                const activeTab = querySel<HTMLButtonElement>('.tournament-tabs .tab-item.active')?.dataset.status || 'upcoming';
                filterTournaments(currentTournamentGameId, activeTab);
            } else {
                elements.tournamentsListContainer.innerHTML = '<p class="text-secondary text-center mt-4">Select a game from Home page first.</p>';
            }
            break;
    }
    if (sectionId === 'login-section') {
        toggleLoginForm(true);
    }
    // Smooth, reliable scroll to top on section navigation
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
}

function updateHeaderForSection(sectionId: string, backSection: string | null = null) {
    const isMessages = (sectionId === 'messages-section');
    const isFriends = (sectionId === 'friends-section');
    const isRequests = (sectionId === 'friend-requests-section');
    const showBackButton = (sectionId === 'tournaments-section' || sectionId === 'recharge-section' || isMessages || isFriends || isRequests);
    const defaultTitleVisible = !showBackButton;
    const gameTitleVisible = (sectionId === 'tournaments-section');
    const rechargeTitleVisible = (sectionId === 'recharge-section');

    if (elements.headerBackBtn) {
        elements.headerBackBtn.style.display = showBackButton ? 'inline-block' : 'none';
        if (showBackButton) {
            let targetBackSection = backSection;
            if (!targetBackSection) {
                if (sectionId === 'tournaments-section') targetBackSection = 'home-section';
                else if (sectionId === 'recharge-section') targetBackSection = 'wallet-section';
                else if (isMessages || isFriends || isRequests) targetBackSection = 'profile-section';
            }
            elements.headerBackBtn.onclick = () => showSection(targetBackSection);
        }
    }
    if (elements.headerTitleContainer) elements.headerTitleContainer.style.display = defaultTitleVisible ? 'flex' : 'none';
    if (elements.headerGameTitle) elements.headerGameTitle.style.display = (gameTitleVisible || rechargeTitleVisible || isMessages || isFriends || isRequests) ? 'block' : 'none';
    if (gameTitleVisible && currentTournamentGameId && elements.headerGameTitle) {
        const gameName = appSettings?.games?.[currentTournamentGameId]?.name || `Tournaments`;
        elements.headerGameTitle.textContent = gameName;
    } else if (rechargeTitleVisible && elements.headerGameTitle) {
        elements.headerGameTitle.textContent = 'Add Amount';
    } else if (isMessages && elements.headerGameTitle) {
        elements.headerGameTitle.textContent = 'Messages';
    } else if (isFriends && elements.headerGameTitle) {
        elements.headerGameTitle.textContent = 'Friends';
    } else if (isRequests && elements.headerGameTitle) {
        elements.headerGameTitle.textContent = 'Friend Requests';
    } else if (defaultTitleVisible && elements.headerUserGreeting) {
        const nameToShow = userProfile?.displayName?.split(' ')[0] || (currentUser ? currentUser.email?.split('@')[0] : 'Guest') || 'Guest';
        elements.headerUserGreeting.textContent = nameToShow;
    }
}

function updateGlobalUI(isLoggedIn: boolean) {
    if (elements.headerWalletChip) {
        elements.headerWalletChip.style.display = isLoggedIn ? 'flex' : 'none';
        if (isLoggedIn) elements.headerWalletChip.onclick = () => showSection('wallet-section');
        else elements.headerWalletChip.onclick = null;
    }
    if (!isLoggedIn && elements.headerUserGreeting) elements.headerUserGreeting.textContent = 'Guest';
    if (!isLoggedIn && elements.headerChipBalance) elements.headerChipBalance.textContent = '0';
    elements.bottomNavItems.forEach(item => {
        const section = item.dataset.section;
        item.style.display = (section === 'home-section' || isLoggedIn) ? 'flex' : 'none';
    });
}

function getInstagramUrl(input?: string): string | null {
    if (!input || !input.trim()) return null;
    let clean = input.trim();
    if (clean.startsWith('@')) clean = clean.substring(1);
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    if (clean.includes('instagram.com/')) return `https://${clean}`;
    return `https://instagram.com/${clean}`;
}

function getYoutubeUrl(input?: string): string | null {
    if (!input || !input.trim()) return null;
    let clean = input.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    if (clean.includes('youtube.com/') || clean.includes('youtu.be/')) return `https://${clean}`;
    if (clean.startsWith('@')) return `https://youtube.com/${clean}`;
    return `https://youtube.com/@${clean}`;
}

function extractBalances(profile: any) {
    if (!profile) return { deposit: 0, winning: 0, bonus: 0, total: 0 };

    const deposit = Math.max(0, parseFloat(
        profile.depositBalance ??
        profile.deposit ??
        profile.depositedBalance ??
        profile.deposit_balance ??
        profile.deposited ??
        profile.depositCash ??
        0
    ) || 0);

    const winning = Math.max(0, parseFloat(
        profile.winningCash ??
        profile.winnings ??
        profile.winningBalance ??
        profile.winning_cash ??
        profile.winningAmount ??
        profile.winCash ??
        profile.winBalance ??
        0
    ) || 0);

    const bonus = Math.max(0, parseFloat(
        profile.bonusCash ??
        profile.bonus ??
        profile.bonusBalance ??
        profile.bonus_cash ??
        profile.bonusAmount ??
        0
    ) || 0);

    return { deposit, winning, bonus, total: deposit + winning + bonus };
}

let isReconcilingTransactions = false;
const processedAdminDepositKeys = new Set<string>();

async function reconcileTransactions(uid: string) {
    if (!uid || !db || isReconcilingTransactions) return;
    isReconcilingTransactions = true;
    try {
        const transRef = ref(db, `transactions/${uid}`);
        const snap = await get(transRef);
        if (!snap.exists()) {
            return;
        }

        const txKeysToCredit: Array<{ key: string; amount: number }> = [];

        snap.forEach((child) => {
            const tx = child.val();
            const txKey = child.key;
            if (!tx || !txKey) return;

            // Only 'admin_deposit' needs reconciliation because the Admin Panel's manual deposit action
            // updates `balance` without incrementing `depositBalance`.
            // All other admin actions (`admin_winning_add`, `deposit_completed`, `tournament_winnings`, `withdrawal_refund`)
            // already update `winningCash` or `depositBalance` directly in the Admin Panel.
            if (tx.type !== 'admin_deposit') return;

            if (tx.credited === true || tx.isCredited === true || tx.processed === true) {
                processedAdminDepositKeys.add(`${uid}_${txKey}`);
                return;
            }
            if (processedAdminDepositKeys.has(`${uid}_${txKey}`)) {
                return;
            }

            const amt = parseFloat(tx.amount);
            if (isNaN(amt) || amt <= 0) return;

            txKeysToCredit.push({ key: txKey, amount: amt });
        });

        let creditedTotal = 0;
        for (const item of txKeysToCredit) {
            processedAdminDepositKeys.add(`${uid}_${item.key}`);
            try {
                const creditFlagRef = ref(db, `transactions/${uid}/${item.key}/credited`);
                const claimRes = await runTransaction(creditFlagRef, (cur) => {
                    if (cur === true) return; // Abort if already claimed
                    return true;
                });
                if (claimRes.committed && claimRes.snapshot.val() === true) {
                    creditedTotal += item.amount;
                    update(ref(db, `transactions/${uid}/${item.key}`), {
                        credited: true,
                        creditedAt: serverTimestamp()
                    }).catch(() => {});
                }
            } catch (_) {}
        }

        if (creditedTotal > 0) {
            const uRef = ref(db, `users/${uid}`);
            const txRes = await runTransaction(uRef, (prof) => {
                if (!prof) return prof;
                const curBalances = extractBalances(prof);
                const newDeposit = curBalances.deposit + creditedTotal;
                const newTotal = newDeposit + curBalances.winning + curBalances.bonus;
                prof.depositBalance = newDeposit;
                prof.balance = newTotal;
                prof.walletBalance = newTotal;
                return prof;
            });

            if (txRes.committed && txRes.snapshot.exists()) {
                userProfile = txRes.snapshot.val();
                if (currentUser && currentUser.uid === uid) {
                    populateUserInfo(currentUser, userProfile);
                }
            }
        }
    } catch (err) {
        console.error("Error in reconcileTransactions:", err);
    } finally {
        isReconcilingTransactions = false;
    }
}

function populateUserInfo(user: User, profile: any) {
    if (!user || !profile) return;
    const displayName = profile.displayName || user.email?.split('@')[0] || 'User';
    const defaultAvatarUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0F172A&color=E2E8F0&bold=true&size=75`;
    const photoURL = resolveUserAvatarUrl(profile, defaultAvatarUrl);

    const balances = extractBalances(profile);
    const depositBalance = balances.deposit;
    const winningCash = balances.winning;
    const bonusCash = balances.bonus;
    const totalBalance = balances.total;

    // Keep userProfile object synchronized
    userProfile.depositBalance = depositBalance;
    userProfile.winningCash = winningCash;
    userProfile.bonusCash = bonusCash;
    userProfile.balance = totalBalance;
    userProfile.walletBalance = totalBalance;

    const effectiveStats = getEffectiveUserStats(user.uid, profile);
    const totalEarnings = effectiveStats.totalEarnings;
    const referralEarnings = (profile.referralEarnings || 0);
    const totalMatches = effectiveStats.totalMatches;
    const wonMatches = effectiveStats.wonMatches;
    const formatCurrency = (amount: number) => `${amount.toFixed(2)}`;
    if (!leaderboardStatsCache[user.uid]) {
        ensureLeaderboardStatsCacheLoaded();
    }

    if (elements.headerUserGreeting) elements.headerUserGreeting.textContent = displayName.split(' ')[0];
    if (elements.headerChipBalance) elements.headerChipBalance.textContent = String(Math.floor(totalBalance));

    if (elements.walletTotalBalance) {
        elements.walletTotalBalance.textContent = `₹${formatCurrency(totalBalance)}`;
        removePlaceholders(elements.walletTotalBalance.closest('.placeholder-glow'));
    }
    if (elements.walletDepositCash) {
        elements.walletDepositCash.textContent = `₹${formatCurrency(depositBalance)}`;
        removePlaceholders(elements.walletDepositCash.closest('.placeholder-glow'));
    }
    if (elements.walletWinningCash) {
        elements.walletWinningCash.textContent = `₹${formatCurrency(winningCash)}`;
        removePlaceholders(elements.walletWinningCash.closest('.placeholder-glow'));
    }
    if (elements.walletBonusCash) {
        elements.walletBonusCash.textContent = `₹${formatCurrency(bonusCash)}`;
        removePlaceholders(elements.walletBonusCash.closest('.placeholder-glow'));
    }
    if (elements.withdrawModalBalance) elements.withdrawModalBalance.textContent = `₹${formatCurrency(winningCash)}`;
    if (elements.rechargeBalanceDisplay) elements.rechargeBalanceDisplay.textContent = formatCurrency(totalBalance);
    if (elements.profileAvatar) elements.profileAvatar.src = photoURL;
    if (elements.profileName) {
        elements.profileName.textContent = displayName;
        removePlaceholders(elements.profileName.closest('.placeholder-glow'));
    }
    if (elements.profileEmail) {
        elements.profileEmail.textContent = user.email || 'N/A';
        removePlaceholders(elements.profileEmail.closest('.placeholder-glow'));
    }
    if (elements.profileTotalMatches) {
        elements.profileTotalMatches.textContent = String(totalMatches);
        removePlaceholders(elements.profileTotalMatches.closest('.placeholder-glow'));
    }
    if (elements.profileWonMatches) {
        elements.profileWonMatches.textContent = String(wonMatches);
        removePlaceholders(elements.profileWonMatches.closest('.placeholder-glow'));
    }
    if (elements.profileWinRate) {
        const myWinRate = totalMatches > 0 ? Math.round((wonMatches / totalMatches) * 100) : 0;
        elements.profileWinRate.textContent = `${myWinRate}%`;
    }
    if (elements.profileTotalEarnings) {
        elements.profileTotalEarnings.textContent = `₹${formatCurrency(totalEarnings)}`;
        removePlaceholders(elements.profileTotalEarnings.closest('.placeholder-glow'));
    }
    if (elements.earningsTotal) {
        elements.earningsTotal.textContent = `₹${formatCurrency(totalEarnings)}`;
        removePlaceholders(elements.earningsTotal.closest('.placeholder-glow'));
    }
    if (elements.earningsReferral) {
        elements.earningsReferral.textContent = `₹${formatCurrency(referralEarnings)}`;
        removePlaceholders(elements.earningsReferral.closest('.placeholder-glow'));
    }

    // VIP Crown Badge visibility, VIP Header Theme & Avatar VIP Premium Glow
    if (elements.profileVipCrownBadge) {
        elements.profileVipCrownBadge.style.display = profile.isPremium ? 'flex' : 'none';
    }
    if (elements.profileVipRibbon) {
        elements.profileVipRibbon.style.display = profile.isPremium ? 'inline-flex' : 'none';
    }
    if (elements.profileHeaderCard) {
        if (profile.isPremium) {
            elements.profileHeaderCard.classList.add('vip-profile-header-card');
        } else {
            elements.profileHeaderCard.classList.remove('vip-profile-header-card');
        }
    }
    if (elements.profileAvatar) {
        if (profile.isPremium) {
            elements.profileAvatar.classList.add('vip-avatar-glow');
        } else {
            elements.profileAvatar.classList.remove('vip-avatar-glow');
        }
    }

    // Display Real Profile Likes (0 if no likes)
    if (elements.profileLikesCountValue) {
        const realLikes = typeof profile.likeCount === 'number' && profile.likeCount > 0 ? profile.likeCount : 0;
        elements.profileLikesCountValue.textContent = String(realLikes);
    }
    // Live listener for own profile likes
    if (user && user.uid && elements.profileLikesCountValue && !dbListeners['currentUserProfileLikes']) {
        try {
            const myLikesRef = ref(db, `profileLikes/${user.uid}`);
            const unsubMyLikes = onValue(myLikesRef, (snap) => {
                const data = snap.val();
                let actualLikes = 0;
                if (snap.exists() && data && typeof data === 'object') {
                    actualLikes = Object.keys(data).length;
                } else if (typeof userProfile.likeCount === 'number' && userProfile.likeCount > 0) {
                    actualLikes = userProfile.likeCount;
                }
                userProfile.likeCount = actualLikes;
                if (elements.profileLikesCountValue) {
                    elements.profileLikesCountValue.textContent = String(actualLikes);
                }
            });
            dbListeners['currentUserProfileLikes'] = { path: `profileLikes/${user.uid}`, func: unsubMyLikes };
        } catch (e) {}
    }

    // Profile Bio
    if (elements.profileBioDisplay) {
        elements.profileBioDisplay.textContent = profile.bio && profile.bio.trim() ? `"${profile.bio.trim()}"` : "Tap edit to set your bio";
    }

    // Profile Favourite Gun
    if (elements.profileFavGunDisplay) {
        elements.profileFavGunDisplay.textContent = profile.favGun && profile.favGun.trim() ? profile.favGun.trim() : "Not Set";
    }

    // Profile Social Links (Always visible side-by-side like the reference screenshots)
    const myInsta = getInstagramUrl(profile.instagram);
    if (elements.profileInstagramLink) {
        elements.profileInstagramLink.style.display = 'inline-flex';
        if (myInsta) {
            elements.profileInstagramLink.href = myInsta;
            elements.profileInstagramLink.onclick = null;
        } else {
            elements.profileInstagramLink.href = '#';
            elements.profileInstagramLink.onclick = (e) => {
                e.preventDefault();
                openEditNameModal();
            };
        }
    }
    const myYt = getYoutubeUrl(profile.youtube);
    if (elements.profileYoutubeLink) {
        elements.profileYoutubeLink.style.display = 'inline-flex';
        if (myYt) {
            elements.profileYoutubeLink.href = myYt;
            elements.profileYoutubeLink.onclick = null;
        } else {
            elements.profileYoutubeLink.href = '#';
            elements.profileYoutubeLink.onclick = (e) => {
                e.preventDefault();
                openEditNameModal();
            };
        }
    }

    // Sync Notification Switch with user settings (stays ON unless user explicitly disabled it)
    if (elements.notificationSwitch) {
        elements.notificationSwitch.checked = isNotificationsEnabled(profile);
    }
    if (user && user.uid) {
        syncServiceWorkerUserState(user.uid, isNotificationsEnabled(profile));
    }

    // Update Free Fire Style Rank Profile Showcase & Daily Login Strike UI
    updateProfileRankAndDailyLoginUI(profile);
}

/* =========================================================
   FREE FIRE RANK PROGRESSION (BRONZE I–IV TO GRANDMASTER I–IV)
   & DAILY LOGIN MYSTERY BOX (+2 / +3 EXP & STRIKE SYSTEM)
   ========================================================= */
interface RankLevelDef {
    index: number;
    id: string;
    name: string;
    tier: 'bronze' | 'silver' | 'platinum' | 'diamond' | 'heroic' | 'grandmaster';
    roman: 'I' | 'II' | 'III' | 'IV';
    minExp: number;
    maxExp: number;
}

const FF_RANK_LEVELS: RankLevelDef[] = [
    // Bronze I -> IV (10/10 EXP completes Bronze I -> converts to Bronze II!)
    { index: 0,  id: 'bronze_1',      name: 'Bronze I',        tier: 'bronze',      roman: 'I',   minExp: 0,   maxExp: 10 },
    { index: 1,  id: 'bronze_2',      name: 'Bronze II',       tier: 'bronze',      roman: 'II',  minExp: 10,  maxExp: 22 },
    { index: 2,  id: 'bronze_3',      name: 'Bronze III',      tier: 'bronze',      roman: 'III', minExp: 22,  maxExp: 36 },
    { index: 3,  id: 'bronze_4',      name: 'Bronze IV',       tier: 'bronze',      roman: 'IV',  minExp: 36,  maxExp: 52 },
    // Silver I -> IV
    { index: 4,  id: 'silver_1',      name: 'Silver I',        tier: 'silver',      roman: 'I',   minExp: 52,  maxExp: 68 },
    { index: 5,  id: 'silver_2',      name: 'Silver II',       tier: 'silver',      roman: 'II',  minExp: 68,  maxExp: 86 },
    { index: 6,  id: 'silver_3',      name: 'Silver III',      tier: 'silver',      roman: 'III', minExp: 86,  maxExp: 106 },
    { index: 7,  id: 'silver_4',      name: 'Silver IV',       tier: 'silver',      roman: 'IV',  minExp: 106, maxExp: 128 },
    // Platinum I -> IV
    { index: 8,  id: 'platinum_1',    name: 'Platinum I',      tier: 'platinum',    roman: 'I',   minExp: 128, maxExp: 150 },
    { index: 9,  id: 'platinum_2',    name: 'Platinum II',     tier: 'platinum',    roman: 'II',  minExp: 150, maxExp: 174 },
    { index: 10, id: 'platinum_3',    name: 'Platinum III',    tier: 'platinum',    roman: 'III', minExp: 174, maxExp: 200 },
    { index: 11, id: 'platinum_4',    name: 'Platinum IV',     tier: 'platinum',    roman: 'IV',  minExp: 200, maxExp: 228 },
    // Diamond I -> IV
    { index: 12, id: 'diamond_1',     name: 'Diamond I',       tier: 'diamond',     roman: 'I',   minExp: 228, maxExp: 256 },
    { index: 13, id: 'diamond_2',     name: 'Diamond II',      tier: 'diamond',     roman: 'II',  minExp: 256, maxExp: 286 },
    { index: 14, id: 'diamond_3',     name: 'Diamond III',     tier: 'diamond',     roman: 'III', minExp: 286, maxExp: 318 },
    { index: 15, id: 'diamond_4',     name: 'Diamond IV',      tier: 'diamond',     roman: 'IV',  minExp: 318, maxExp: 352 },
    // Heroic I -> IV (High EXP requirement towards Grandmaster ~6+ months)
    { index: 16, id: 'heroic_1',      name: 'Heroic I',        tier: 'heroic',      roman: 'I',   minExp: 352, maxExp: 388 },
    { index: 17, id: 'heroic_2',      name: 'Heroic II',       tier: 'heroic',      roman: 'II',  minExp: 388, maxExp: 428 },
    { index: 18, id: 'heroic_3',      name: 'Heroic III',      tier: 'heroic',      roman: 'III', minExp: 428, maxExp: 470 },
    { index: 19, id: 'heroic_4',      name: 'Heroic IV',       tier: 'heroic',      roman: 'IV',  minExp: 470, maxExp: 515 },
    // Grandmaster I -> IV (450-515+ EXP = ~6+ months of daily 2-3 EXP boxes)
    { index: 20, id: 'grandmaster_1', name: 'Grandmaster I',   tier: 'grandmaster', roman: 'I',   minExp: 515, maxExp: 570 },
    { index: 21, id: 'grandmaster_2', name: 'Grandmaster II',  tier: 'grandmaster', roman: 'II',  minExp: 570, maxExp: 630 },
    { index: 22, id: 'grandmaster_3', name: 'Grandmaster III', tier: 'grandmaster', roman: 'III', minExp: 630, maxExp: 700 },
    { index: 23, id: 'grandmaster_4', name: 'Grandmaster IV',  tier: 'grandmaster', roman: 'IV',  minExp: 700, maxExp: 800 },
];

function getRankInfoFromExp(rawExp: any): { current: RankLevelDef; next: RankLevelDef | null; exp: number; progressPct: number } {
    const exp = Math.max(0, Math.floor(Number(rawExp) || 0));
    let current = FF_RANK_LEVELS[0];
    for (let i = 0; i < FF_RANK_LEVELS.length; i++) {
        if (exp >= FF_RANK_LEVELS[i].minExp) {
            current = FF_RANK_LEVELS[i];
        } else {
            break;
        }
    }
    const next = current.index + 1 < FF_RANK_LEVELS.length ? FF_RANK_LEVELS[current.index + 1] : null;
    let progressPct = 100;
    if (next) {
        const span = Math.max(1, current.maxExp - current.minExp);
        const gainedInLevel = Math.max(0, exp - current.minExp);
        progressPct = Math.min(100, Math.max(0, Math.round((gainedInLevel / span) * 100)));
    }
    return { current, next, exp, progressPct };
}

function getLocalDateKey(dateObj: Date = new Date()): string {
    const yr = dateObj.getFullYear();
    const mo = String(dateObj.getMonth() + 1).padStart(2, '0');
    const da = String(dateObj.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
}

function getYesterdayDateKey(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateKey(d);
}

function evaluateUserDailyStreak(profile: any): { effectiveStreak: number; claimedToday: boolean; lastDate: string } {
    const todayKey = getLocalDateKey();
    const yesterdayKey = getYesterdayDateKey();
    const lastDate = String(profile?.lastDailyClaimDate || '');
    const storedStreak = Math.max(0, Math.floor(Number(profile?.dailyStreak) || 0));

    if (lastDate === todayKey) {
        return { effectiveStreak: Math.max(1, storedStreak), claimedToday: true, lastDate };
    }
    if (lastDate === yesterdayKey) {
        return { effectiveStreak: storedStreak, claimedToday: false, lastDate };
    }
    // Missed 1 or more days -> strike resets!
    return { effectiveStreak: 0, claimedToday: false, lastDate };
}

function renderFreeFireRankSvg(rank: RankLevelDef): string {
    const uidSuffix = `${rank.id}_${Math.random().toString(36).slice(2, 6)}`;
    const roman = rank.roman;
    const arabNum = rank.index % 4 + 1;
    const ribbonLabel =
        rank.tier === 'bronze' ? `BRONZE ${arabNum}` :
        rank.tier === 'silver' ? `SILVER ${arabNum}` :
        rank.tier === 'platinum' ? `PLATINUM ${arabNum}` :
        rank.tier === 'diamond' ? `DIAMOND ${arabNum}` :
        rank.tier === 'heroic' ? (arabNum === 1 ? 'HEROIC' : `HEROIC ${roman}`) :
        (arabNum === 1 ? 'GRANDMASTER' : `GRANDMASTER ${roman}`);

    if (rank.tier === 'bronze') {
        return `
        <svg viewBox="0 0 130 135" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="brRim_${uidSuffix}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FDE68A"/>
                    <stop offset="45%" stop-color="#D97706"/>
                    <stop offset="100%" stop-color="#78350F"/>
                </linearGradient>
                <linearGradient id="brCore_${uidSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#9A3412"/>
                    <stop offset="100%" stop-color="#271006"/>
                </linearGradient>
            </defs>
            <!-- Side Bronze Wings -->
            <path d="M25 42 L6 30 L14 56 L6 68 L28 74 Z" fill="url(#brRim_${uidSuffix})"/>
            <path d="M105 42 L124 30 L116 56 L124 68 L102 74 Z" fill="url(#brRim_${uidSuffix})"/>
            <!-- Main Hexagonal Shield -->
            <polygon points="65,10 102,26 94,80 65,104 36,80 28,26" fill="url(#brCore_${uidSuffix})" stroke="url(#brRim_${uidSuffix})" stroke-width="5" stroke-linejoin="round"/>
            <polygon points="65,18 94,31 87,75 65,95 43,75 36,31" fill="none" stroke="#FDE68A" stroke-width="1.5" opacity="0.7"/>
            <polygon points="65,15 75,26 65,33 55,26" fill="url(#brRim_${uidSuffix})"/>
            <text x="65" y="70" font-family="'Impact', 'Arial Black', sans-serif" font-size="31" font-weight="900" text-anchor="middle" fill="url(#brRim_${uidSuffix})" stroke="#271006" stroke-width="1.5">${arabNum}</text>
            <!-- Metallic Nameplate Ribbon -->
            <polygon points="14,96 116,96 108,118 22,118" fill="#271006" stroke="url(#brRim_${uidSuffix})" stroke-width="2.5"/>
            <text x="65" y="111" font-family="'Impact', 'Arial Black', sans-serif" font-size="13.5" font-weight="900" letter-spacing="0.8" text-anchor="middle" fill="#FDE68A">${ribbonLabel}</text>
        </svg>`;
    }

    if (rank.tier === 'silver') {
        return `
        <svg viewBox="0 0 130 135" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="slRim_${uidSuffix}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FFFFFF"/>
                    <stop offset="50%" stop-color="#CBD5E1"/>
                    <stop offset="100%" stop-color="#475569"/>
                </linearGradient>
                <linearGradient id="slCore_${uidSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#334155"/>
                    <stop offset="100%" stop-color="#0F172A"/>
                </linearGradient>
            </defs>
            <!-- Silver Feathered Wings -->
            <path d="M26 36 L3 22 L11 48 L4 62 L28 74 Z" fill="url(#slRim_${uidSuffix})"/>
            <path d="M104 36 L127 22 L119 48 L126 62 L102 74 Z" fill="url(#slRim_${uidSuffix})"/>
            <!-- Shield Body -->
            <polygon points="65,10 102,26 94,80 65,104 36,80 28,26" fill="url(#slCore_${uidSuffix})" stroke="url(#slRim_${uidSuffix})" stroke-width="5" stroke-linejoin="round"/>
            <polygon points="65,18 94,31 87,75 65,95 43,75 36,31" fill="none" stroke="#FFFFFF" stroke-width="1.6" opacity="0.8"/>
            <polygon points="65,14 77,26 65,34 53,26" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1"/>
            <text x="65" y="70" font-family="'Impact', 'Arial Black', sans-serif" font-size="31" font-weight="900" text-anchor="middle" fill="#F8FAFC" stroke="#0F172A" stroke-width="1.5">${arabNum}</text>
            <!-- Metallic Nameplate Ribbon -->
            <polygon points="14,96 116,96 108,118 22,118" fill="#0F172A" stroke="url(#slRim_${uidSuffix})" stroke-width="2.5"/>
            <text x="65" y="111" font-family="'Impact', 'Arial Black', sans-serif" font-size="13.5" font-weight="900" letter-spacing="0.8" text-anchor="middle" fill="#F8FAFC">${ribbonLabel}</text>
        </svg>`;
    }

    if (rank.tier === 'platinum') {
        return `
        <svg viewBox="0 0 130 135" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="plRim_${uidSuffix}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FFFFFF"/>
                    <stop offset="50%" stop-color="#7DD3FC"/>
                    <stop offset="100%" stop-color="#0284C7"/>
                </linearGradient>
                <linearGradient id="plGold_${uidSuffix}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FEF08A"/>
                    <stop offset="100%" stop-color="#D97706"/>
                </linearGradient>
                <linearGradient id="plCore_${uidSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#0E7490"/>
                    <stop offset="100%" stop-color="#082F49"/>
                </linearGradient>
            </defs>
            <!-- Sweeping Platinum Wings -->
            <path d="M28 34 L2 18 L9 42 L2 56 L13 70 L32 78 Z" fill="url(#plRim_${uidSuffix})" stroke="#E0F2FE" stroke-width="1"/>
            <path d="M102 34 L128 18 L121 42 L128 56 L117 70 L98 78 Z" fill="url(#plRim_${uidSuffix})" stroke="#E0F2FE" stroke-width="1"/>
            <!-- Top Golden Crown -->
            <path d="M46 20 L50 8 L59 16 L65 5 L71 16 L80 8 L84 20 Z" fill="url(#plGold_${uidSuffix})" stroke="#FFF" stroke-width="1"/>
            <!-- Main Platinum Crest -->
            <polygon points="65,16 101,30 92,82 65,105 38,82 29,30" fill="url(#plCore_${uidSuffix})" stroke="url(#plRim_${uidSuffix})" stroke-width="5" stroke-linejoin="round"/>
            <polygon points="65,24 92,35 85,77 65,96 45,77 38,35" fill="none" stroke="#E0F2FE" stroke-width="2" opacity="0.85"/>
            <text x="65" y="71" font-family="'Impact', 'Arial Black', sans-serif" font-size="31" font-weight="900" text-anchor="middle" fill="#FFFFFF" stroke="#082F49" stroke-width="1.5">${arabNum}</text>
            <!-- Metallic Nameplate Ribbon -->
            <polygon points="10,96 120,96 112,118 18,118" fill="#082F49" stroke="url(#plRim_${uidSuffix})" stroke-width="2.5"/>
            <text x="65" y="111" font-family="'Impact', 'Arial Black', sans-serif" font-size="12.5" font-weight="900" letter-spacing="0.6" text-anchor="middle" fill="#E0F2FE">${ribbonLabel}</text>
        </svg>`;
    }

    if (rank.tier === 'diamond') {
        return `
        <svg viewBox="0 0 130 135" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="dmWing_${uidSuffix}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FFFFFF"/>
                    <stop offset="45%" stop-color="#38BDF8"/>
                    <stop offset="100%" stop-color="#1D4ED8"/>
                </linearGradient>
                <linearGradient id="dmCore_${uidSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#2563EB"/>
                    <stop offset="50%" stop-color="#1E3A8A"/>
                    <stop offset="100%" stop-color="#090D26"/>
                </linearGradient>
            </defs>
            <!-- Radiant Crystal Wings -->
            <path d="M30 30 L1 12 L9 38 L0 52 L11 66 L7 78 L34 82 Z" fill="url(#dmWing_${uidSuffix})" stroke="#E0F2FE" stroke-width="1.2"/>
            <path d="M100 30 L129 12 L121 38 L130 52 L119 66 L123 78 L96 82 Z" fill="url(#dmWing_${uidSuffix})" stroke="#E0F2FE" stroke-width="1.2"/>
            <!-- Top Crystal Spire -->
            <polygon points="65,3 77,18 65,26 53,18" fill="#7DD3FC" stroke="#FFFFFF" stroke-width="1.5"/>
            <!-- Main Diamond Shield -->
            <polygon points="65,15 102,30 92,82 65,106 38,82 28,30" fill="url(#dmCore_${uidSuffix})" stroke="#7DD3FC" stroke-width="4.5" stroke-linejoin="round"/>
            <polygon points="65,24 90,40 82,78 65,94 48,78 40,40" fill="rgba(56, 189, 248, 0.25)" stroke="#E0F2FE" stroke-width="2"/>
            <text x="65" y="71" font-family="'Impact', 'Arial Black', sans-serif" font-size="31" font-weight="900" text-anchor="middle" fill="#FFFFFF" stroke="#1E3A8A" stroke-width="1.5">${arabNum}</text>
            <!-- Metallic Nameplate Ribbon -->
            <polygon points="10,96 120,96 112,118 18,118" fill="#0C1E3E" stroke="#38BDF8" stroke-width="2.5"/>
            <text x="65" y="111" font-family="'Impact', 'Arial Black', sans-serif" font-size="12.5" font-weight="900" letter-spacing="0.6" text-anchor="middle" fill="#7DD3FC">${ribbonLabel}</text>
        </svg>`;
    }

    if (rank.tier === 'heroic') {
        return `
        <svg viewBox="0 0 130 135" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="hrGold_${uidSuffix}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FEF08A"/>
                    <stop offset="50%" stop-color="#F59E0B"/>
                    <stop offset="100%" stop-color="#92400E"/>
                </linearGradient>
                <linearGradient id="hrRed_${uidSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#EF4444"/>
                    <stop offset="55%" stop-color="#991B1B"/>
                    <stop offset="100%" stop-color="#3B0707"/>
                </linearGradient>
            </defs>
            <!-- Heroic Crimson & Gold Battle Wings -->
            <path d="M30 28 L0 10 L9 36 L0 50 L11 66 L5 80 L36 84 Z" fill="url(#hrRed_${uidSuffix})" stroke="url(#hrGold_${uidSuffix})" stroke-width="2.2"/>
            <path d="M100 28 L130 10 L121 36 L130 50 L119 66 L125 80 L94 84 Z" fill="url(#hrRed_${uidSuffix})" stroke="url(#hrGold_${uidSuffix})" stroke-width="2.2"/>
            <!-- Horned Golden Crown -->
            <path d="M36 22 C30 8 42 4 50 16 L65 4 L80 16 C88 4 100 8 94 22 Z" fill="url(#hrGold_${uidSuffix})" stroke="#FEF08A" stroke-width="1.2"/>
            <!-- Crimson Shield Plate -->
            <polygon points="65,15 102,30 92,84 65,106 38,84 28,30" fill="url(#hrRed_${uidSuffix})" stroke="url(#hrGold_${uidSuffix})" stroke-width="5" stroke-linejoin="round"/>
            <!-- Inner Heroic Eagle/Warrior Crest -->
            <path d="M46 40 L65 30 L84 40 L80 66 L65 80 L50 66 Z" fill="rgba(0,0,0,0.42)" stroke="url(#hrGold_${uidSuffix})" stroke-width="2"/>
            <polygon points="51,47 60,50 53,53" fill="#FEF08A"/>
            <polygon points="79,47 70,50 77,53" fill="#FEF08A"/>
            <text x="65" y="75" font-family="'Impact', 'Arial Black', sans-serif" font-size="18" font-weight="900" text-anchor="middle" fill="#FEF08A">${roman}</text>
            <!-- Metallic Nameplate Ribbon -->
            <polygon points="10,96 120,96 112,118 18,118" fill="#3B0707" stroke="url(#hrGold_${uidSuffix})" stroke-width="2.5"/>
            <text x="65" y="111" font-family="'Impact', 'Arial Black', sans-serif" font-size="12.5" font-weight="900" letter-spacing="0.6" text-anchor="middle" fill="#FEF08A">${ribbonLabel}</text>
        </svg>`;
    }

    // Grandmaster (Tier: grandmaster) - Supreme Golden Winged Crest
    return `
    <svg viewBox="0 0 130 135" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="gmGold_${uidSuffix}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FFFFFF"/>
                <stop offset="30%" stop-color="#FEF08A"/>
                <stop offset="65%" stop-color="#F59E0B"/>
                <stop offset="100%" stop-color="#B45309"/>
            </linearGradient>
            <linearGradient id="gmCore_${uidSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#F59E0B"/>
                <stop offset="50%" stop-color="#B45309"/>
                <stop offset="100%" stop-color="#451A03"/>
            </linearGradient>
        </defs>
        <!-- Supreme Grandmaster Multi-Layered Golden Wings -->
        <path d="M32 26 L0 6 L7 32 L0 46 L9 62 L0 76 L15 88 L38 88 Z" fill="url(#gmGold_${uidSuffix})" stroke="#FFFFFF" stroke-width="1.2"/>
        <path d="M98 26 L130 6 L123 32 L130 46 L121 62 L130 76 L115 88 L92 88 Z" fill="url(#gmGold_${uidSuffix})" stroke="#FFFFFF" stroke-width="1.2"/>
        <!-- Royal Top Crown & Star -->
        <path d="M40 20 L46 5 L57 15 L65 2 L73 15 L84 5 L90 20 Z" fill="url(#gmGold_${uidSuffix})" stroke="#FFFFFF" stroke-width="1.2"/>
        <!-- Grandmaster Shield Core -->
        <polygon points="65,15 102,30 92,84 65,106 38,84 28,30" fill="url(#gmCore_${uidSuffix})" stroke="url(#gmGold_${uidSuffix})" stroke-width="5.5" stroke-linejoin="round"/>
        <polygon points="65,23 92,36 84,78 65,98 46,78 38,36" fill="none" stroke="#FEF08A" stroke-width="2"/>
        <!-- Center Radiant Star -->
        <polygon points="65,26 69,36 80,36 71,42 74,53 65,46 56,53 59,42 50,36 61,36" fill="#FFFFFF"/>
        <text x="65" y="76" font-family="'Impact', 'Arial Black', sans-serif" font-size="20" font-weight="900" text-anchor="middle" fill="#FEF08A">${roman}</text>
        <!-- Metallic Nameplate Ribbon -->
        <polygon points="6,96 124,96 116,118 14,118" fill="#271203" stroke="url(#gmGold_${uidSuffix})" stroke-width="2.5"/>
        <text x="65" y="111" font-family="'Impact', 'Arial Black', sans-serif" font-size="11" font-weight="900" letter-spacing="0.4" text-anchor="middle" fill="#FEF08A">${ribbonLabel}</text>
    </svg>`;
}

function applyRankTierThemeClass(el: HTMLElement | null | undefined, tier: string) {
    if (!el) return;
    el.classList.remove(
        'rank-tier-bronze',
        'rank-tier-silver',
        'rank-tier-platinum',
        'rank-tier-diamond',
        'rank-tier-heroic',
        'rank-tier-grandmaster'
    );
    el.classList.add(`rank-tier-${tier}`);
}

function updateProfileRankAndDailyLoginUI(profile: any) {
    if (!profile) return;
    const rankData = getRankInfoFromExp(profile.rankExp || 0);
    const streakData = evaluateUserDailyStreak(profile);

    // Apply tier theme to both the Rank Showcase Card and the main Profile Header Card
    applyRankTierThemeClass(elements.profileRankShowcaseCard, rankData.current.tier);
    applyRankTierThemeClass(elements.profileHeaderCard, rankData.current.tier);

    if (elements.profileRankEmblemContainer) {
        elements.profileRankEmblemContainer.innerHTML = renderFreeFireRankSvg(rankData.current);
    }
    if (elements.profileRankTitle) {
        elements.profileRankTitle.textContent = rankData.current.name.toUpperCase();
    }
    if (elements.profileRankNextHint) {
        if (rankData.next) {
            elements.profileRankNextHint.textContent = `Next: ${rankData.next.name} (${rankData.current.maxExp} EXP)`;
        } else {
            elements.profileRankNextHint.textContent = `MAX RANK ACHIEVED 🏆`;
        }
    }
    if (elements.profileDailyStreakBadge) {
        elements.profileDailyStreakBadge.innerHTML = `<i class="bi bi-fire text-warning"></i> ${streakData.effectiveStreak} Day Strike`;
    }
    if (elements.profileRankExpText) {
        if (rankData.next) {
            elements.profileRankExpText.textContent = `${rankData.exp} / ${rankData.current.maxExp} EXP`;
        } else {
            elements.profileRankExpText.textContent = `${rankData.exp} EXP (MAX)`;
        }
    }
    if (elements.profileRankExpFill) {
        elements.profileRankExpFill.style.width = `${rankData.progressPct}%`;
    }

    // Update Daily Box Trigger Button state at Top of Home Screen
    const rankProgressMini = rankData.next
        ? `${rankData.current.name} (${rankData.exp}/${rankData.current.maxExp} EXP)`
        : `${rankData.current.name} (MAX)`;

    if (streakData.claimedToday) {
        if (elements.profileDailyBoxMiniIcon) {
            elements.profileDailyBoxMiniIcon.classList.remove('ready-pulse');
        }
        if (elements.profileDailyBoxActionBadge) {
            elements.profileDailyBoxActionBadge.className = 'daily-claim-badge claim-done';
            elements.profileDailyBoxActionBadge.innerHTML = '<i class="bi bi-check2-circle me-1"></i>CLAIMED';
        }
        if (elements.profileDailyBoxSubtext) {
            elements.profileDailyBoxSubtext.innerHTML = `Today's box opened! • <span id="homeTopRankMiniTextEl">${rankProgressMini}</span>`;
        }
        if (elements.dailyLoginMenuBadge) {
            elements.dailyLoginMenuBadge.className = 'badge bg-success text-white rounded-pill fw-bold';
            elements.dailyLoginMenuBadge.textContent = `${streakData.effectiveStreak}🔥 DONE`;
        }
    } else {
        if (elements.profileDailyBoxMiniIcon) {
            elements.profileDailyBoxMiniIcon.classList.add('ready-pulse');
        }
        if (elements.profileDailyBoxActionBadge) {
            elements.profileDailyBoxActionBadge.className = 'daily-claim-badge claim-ready';
            elements.profileDailyBoxActionBadge.textContent = 'OPEN BOX';
        }
        if (elements.profileDailyBoxSubtext) {
            elements.profileDailyBoxSubtext.innerHTML = `Open daily box for +2 or +3 EXP • <span id="homeTopRankMiniTextEl">${rankProgressMini}</span>`;
        }
        if (elements.dailyLoginMenuBadge) {
            elements.dailyLoginMenuBadge.className = 'badge bg-warning text-dark rounded-pill fw-bold';
            elements.dailyLoginMenuBadge.textContent = 'OPEN BOX';
        }
    }
}

function updateInspectedPlayerRankUI(user: any) {
    if (!user) return;
    const rankData = getRankInfoFromExp(user.rankExp || 0);
    const streakData = evaluateUserDailyStreak(user);

    // Apply tier theme to the full modal shell (.ff-master-profile-shell) and hero banner
    applyRankTierThemeClass(elements.lbModalContent, rankData.current.tier);
    applyRankTierThemeClass(elements.lbModalRankShowcaseCard, rankData.current.tier);
    if (elements.lbModalRankEmblem) {
        elements.lbModalRankEmblem.innerHTML = renderFreeFireRankSvg(rankData.current);
    }
    if (elements.lbModalRankTitle) {
        elements.lbModalRankTitle.textContent = rankData.current.name.toUpperCase();
    }
    if (elements.lbModalStreakBadge) {
        elements.lbModalStreakBadge.innerHTML = `<i class="bi bi-fire text-warning"></i> ${streakData.effectiveStreak} Day Strike`;
    }
    if (elements.lbModalRankExpText) {
        if (rankData.next) {
            elements.lbModalRankExpText.textContent = `${rankData.exp} / ${rankData.current.maxExp} EXP • Next: ${rankData.next.name}`;
        } else {
            elements.lbModalRankExpText.textContent = `${rankData.exp} EXP • MAX GRANDMASTER IV`;
        }
    }
    if (elements.lbModalRankExpFill) {
        elements.lbModalRankExpFill.style.width = `${rankData.progressPct}%`;
    }
}

function playMysteryBoxOpenAudio() {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
            gain.gain.setValueAtTime(0.22, ctx.currentTime + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + idx * 0.08 + 0.32);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.08);
            osc.stop(ctx.currentTime + idx * 0.08 + 0.32);
        });
    } catch {}
}

function playRankUpFanfareAudio() {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        chord.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
            gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.09);
            gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + idx * 0.09 + 0.65);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.09);
            osc.stop(ctx.currentTime + idx * 0.09 + 0.65);
        });
    } catch {}
}

function showRankUpCelebrationOverlay(rankDef: RankLevelDef, isPreview = false) {
    if (!elements.ffRankUpCelebrationOverlay) return;

    // Customize cosmic background & glow by tier (matching Photos 3, 4, 5)
    const overlay = elements.ffRankUpCelebrationOverlay;
    let bgStyle = 'radial-gradient(circle at 50% 42%, #452312 0%, #0F172A 58%, #020617 100%)';
    let rayColor = 'rgba(205, 127, 50, 0.25)';
    let glowColor = 'rgba(205, 127, 50, 0.85)';

    if (rankDef.tier === 'silver') {
        bgStyle = 'radial-gradient(circle at 50% 42%, #334155 0%, #0F172A 58%, #020617 100%)';
        rayColor = 'rgba(226, 232, 240, 0.25)';
        glowColor = 'rgba(226, 232, 240, 0.85)';
    } else if (rankDef.tier === 'platinum') {
        bgStyle = 'radial-gradient(circle at 50% 42%, #0E7490 0%, #091926 58%, #020617 100%)';
        rayColor = 'rgba(45, 212, 191, 0.28)';
        glowColor = 'rgba(45, 212, 191, 0.9)';
    } else if (rankDef.tier === 'diamond') {
        bgStyle = 'radial-gradient(circle at 50% 42%, #1D4ED8 0%, #0C1E3E 58%, #020617 100%)';
        rayColor = 'rgba(56, 189, 248, 0.3)';
        glowColor = 'rgba(56, 189, 248, 0.95)';
    } else if (rankDef.tier === 'heroic') {
        bgStyle = 'radial-gradient(circle at 50% 42%, #7F1D1D 0%, #2A060D 58%, #050204 100%)';
        rayColor = 'rgba(239, 68, 68, 0.32)';
        glowColor = 'rgba(239, 68, 68, 0.95)';
    } else if (rankDef.tier === 'grandmaster') {
        bgStyle = 'radial-gradient(circle at 50% 42%, #78350F 0%, #3B0764 55%, #030712 100%)';
        rayColor = 'rgba(250, 204, 21, 0.35)';
        glowColor = 'rgba(250, 204, 21, 1)';
    }

    overlay.style.background = bgStyle;
    overlay.style.setProperty('--rankup-ray-color', rayColor);
    overlay.style.setProperty('--rankup-glow', glowColor);

    if (elements.ffRankUpEmblemStage) {
        elements.ffRankUpEmblemStage.innerHTML = renderFreeFireRankSvg(rankDef);
    }
    if (elements.ffRankUpTitleText) {
        elements.ffRankUpTitleText.textContent = rankDef.name.toUpperCase();
    }
    if (elements.ffRankUpSubtitleText) {
        elements.ffRankUpSubtitleText.textContent = isPreview
            ? `${rankDef.name} Tier Preview • Unlocks at ${rankDef.minExp} EXP`
            : `Congratulations! Your profile has converted to ${rankDef.name.toUpperCase()}!`;
    }

    overlay.classList.add('show-overlay');
    playRankUpFanfareAudio();
}

function renderAllRanksRoadmapGrid(currentRankIndex: number, userExp: number) {
    if (!elements.allRanksRoadmapGrid) return;
    elements.allRanksRoadmapGrid.innerHTML = FF_RANK_LEVELS.map(r => {
        const isCurrent = r.index === currentRankIndex;
        const isUnlocked = userExp >= r.minExp;
        const stateClass = isCurrent ? 'current-active unlocked' : (isUnlocked ? 'unlocked' : 'locked');
        return `
            <div class="rank-grid-item ${stateClass}" data-rank-index="${r.index}" title="Tap to preview ${r.name}">
                <div class="rank-grid-svg">${renderFreeFireRankSvg(r)}</div>
                <span class="rank-grid-name">${r.name}</span>
                <span class="rank-grid-exp">${r.minExp} EXP</span>
            </div>
        `;
    }).join('');

    elements.allRanksRoadmapGrid.querySelectorAll('.rank-grid-item').forEach(card => {
        card.addEventListener('click', (e: any) => {
            const idx = Number(e.currentTarget.dataset.rankIndex || 0);
            const targetRank = FF_RANK_LEVELS[idx];
            if (targetRank) {
                showRankUpCelebrationOverlay(targetRank, true);
            }
        });
    });
}

function triggerGiftBoxBurstEffects(expGained: number) {
    const container = elements.dailyGiftBurstContainer;
    if (!container) return;
    container.innerHTML = '';

    // 1. Expanding Golden Shockwave Ring
    const ring = document.createElement('div');
    ring.className = 'gift-shockwave-ring';
    container.appendChild(ring);

    // 2. 24 Explosive 360-degree Burst Particles (Stars, Sparkles, Ribbons, EXP Orbs)
    const burstSymbols = ['✨', '⭐', '🌟', '🎊', '🔥', '💛', `+${expGained} EXP`, '🎉', '💫'];
    for (let i = 0; i < 24; i++) {
        const p = document.createElement('span');
        p.className = 'gift-burst-particle';
        p.textContent = burstSymbols[i % burstSymbols.length];
        if (p.textContent === `+${expGained} EXP`) {
            p.style.fontSize = '0.85rem';
            p.style.color = '#FEF08A';
            p.style.background = 'rgba(220, 38, 38, 0.9)';
            p.style.padding = '2px 7px';
            p.style.borderRadius = '99px';
            p.style.border = '1px solid #FACC15';
        }
        const angle = (Math.PI * 2 * i) / 24 + (Math.random() * 0.2 - 0.1);
        const dist = 65 + Math.random() * 75;
        const bx = Math.round(Math.cos(angle) * dist);
        const by = Math.round(Math.sin(angle) * dist - 15);
        const brot = Math.round((Math.random() - 0.5) * 360);
        p.style.setProperty('--bx', `${bx}px`);
        p.style.setProperty('--by', `${by}px`);
        p.style.setProperty('--brot', `${brot}deg`);
        container.appendChild(p);
    }

    setTimeout(() => {
        if (container) container.innerHTML = '';
    }, 1100);
}

function openDailyLoginRankModal() {
    if (!currentUser) {
        showStatusMessage(elements.loginStatusMessage, "Please login first to claim your Daily Login Gift Box!", "warning");
        showSection('login-section');
        return;
    }

    const rankData = getRankInfoFromExp(userProfile?.rankExp || 0);
    const streakData = evaluateUserDailyStreak(userProfile);

    if (elements.dailyModalCurrentEmblem) {
        elements.dailyModalCurrentEmblem.innerHTML = renderFreeFireRankSvg(rankData.current);
    }
    if (elements.dailyModalCurrentRankName) {
        elements.dailyModalCurrentRankName.textContent = rankData.current.name.toUpperCase();
    }
    if (elements.dailyModalCurrentExpBadge) {
        elements.dailyModalCurrentExpBadge.textContent = rankData.next
            ? `${rankData.exp} / ${rankData.current.maxExp} EXP (Next: ${rankData.next.name})`
            : `${rankData.exp} EXP (MAX RANK)`;
    }
    if (elements.dailyModalStreakCount) {
        elements.dailyModalStreakCount.innerHTML = `<i class="bi bi-fire text-warning"></i> ${streakData.effectiveStreak} Day Strike`;
    }
    if (elements.dailyExpRewardPopContainer) {
        elements.dailyExpRewardPopContainer.innerHTML = '';
    }
    if (elements.dailyGiftBurstContainer) {
        elements.dailyGiftBurstContainer.innerHTML = '';
    }

    if (streakData.claimedToday) {
        if (elements.dailyMysteryBoxGraphic) {
            elements.dailyMysteryBoxGraphic.className = 'mystery-box-svg-wrapper box-opened';
        }
        if (elements.dailyMysteryBoxStatusTitle) {
            elements.dailyMysteryBoxStatusTitle.textContent = `Today's Gift Box Claimed! ✅`;
        }
        if (elements.dailyMysteryBoxStatusDesc) {
            const lastGained = userProfile?.lastDailyExpGained || 2;
            elements.dailyMysteryBoxStatusDesc.innerHTML = `You received <strong class="text-warning">+${lastGained} EXP</strong> today! Login tomorrow to continue your <strong>${streakData.effectiveStreak} Day Strike</strong>.`;
        }
        if (elements.claimDailyBoxBtn) {
            elements.claimDailyBoxBtn.disabled = true;
            elements.claimDailyBoxBtn.innerHTML = `<i class="bi bi-check2-all me-1"></i> Claimed Today (Come Back Tomorrow)`;
        }
    } else {
        if (elements.dailyMysteryBoxGraphic) {
            elements.dailyMysteryBoxGraphic.className = 'mystery-box-svg-wrapper box-idle';
        }
        if (elements.dailyMysteryBoxStatusTitle) {
            elements.dailyMysteryBoxStatusTitle.textContent = `Daily Login Gift Box Ready!`;
        }
        if (elements.dailyMysteryBoxStatusDesc) {
            const nextStreak = streakData.effectiveStreak + 1;
            elements.dailyMysteryBoxStatusDesc.innerHTML = `Tap the gift box to burst it open for <strong class="text-warning">Day ${nextStreak} Strike</strong> &amp; get <strong class="text-warning">+2 or +3 EXP</strong>!`;
        }
        if (elements.claimDailyBoxBtn) {
            elements.claimDailyBoxBtn.disabled = false;
            elements.claimDailyBoxBtn.innerHTML = `<i class="bi bi-gift-fill me-1"></i> Tap to Burst Gift Box (+2 / +3 EXP)`;
        }
    }

    renderAllRanksRoadmapGrid(rankData.current.index, rankData.exp);
    elements.dailyLoginRankModalInstance?.show();
}

let isOpeningDailyMysteryBox = false;

async function handleClaimDailyMysteryBox() {
    if (!currentUser || isOpeningDailyMysteryBox) return;

    const streakData = evaluateUserDailyStreak(userProfile);
    if (streakData.claimedToday) {
        return;
    }

    isOpeningDailyMysteryBox = true;
    if (elements.claimDailyBoxBtn) {
        elements.claimDailyBoxBtn.disabled = true;
        elements.claimDailyBoxBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Bursting Gift Box...`;
    }

    // Start intense shaking & glowing charge-up animation on the Red & Gold Gift Box
    if (elements.dailyMysteryBoxGraphic) {
        elements.dailyMysteryBoxGraphic.className = 'mystery-box-svg-wrapper box-shaking';
    }
    if (elements.dailyMysteryBoxStatusTitle) {
        elements.dailyMysteryBoxStatusTitle.textContent = `Gift Box Charging Up... ✨`;
    }

    // Wait 750ms for dramatic box shake before explosive BURST!
    await new Promise(resolve => setTimeout(resolve, 750));

    // Calculate +2 or +3 EXP reward and new Streak
    const expGained = Math.random() < 0.5 ? 2 : 3;
    const oldExp = Math.max(0, Math.floor(Number(userProfile?.rankExp) || 0));
    const oldRankInfo = getRankInfoFromExp(oldExp);
    const newExp = oldExp + expGained;
    const newRankInfo = getRankInfoFromExp(newExp);
    const newStreak = streakData.effectiveStreak + 1;
    const todayKey = getLocalDateKey();

    // Trigger Explosive Burst State, Lid Fly-Up, Shockwave Ring & 360 Particle Explosion!
    if (elements.dailyMysteryBoxGraphic) {
        elements.dailyMysteryBoxGraphic.className = 'mystery-box-svg-wrapper box-bursting';
    }
    triggerGiftBoxBurstEffects(expGained);
    playMysteryBoxOpenAudio();

    if (elements.dailyExpRewardPopContainer) {
        elements.dailyExpRewardPopContainer.innerHTML = `
            <div class="exp-reward-pop-badge">
                <i class="bi bi-lightning-charge-fill me-1"></i> +${expGained} EXP! 🔥 Day ${newStreak} Strike
            </div>
        `;
    }

    // Update local userProfile state immediately
    userProfile.rankExp = newExp;
    userProfile.dailyStreak = newStreak;
    userProfile.lastDailyClaimDate = todayKey;
    userProfile.lastDailyExpGained = expGained;
    userProfile.rankTitle = newRankInfo.current.name;

    // Persist in Firebase Realtime Database
    try {
        await update(ref(db, `users/${currentUser.uid}`), {
            rankExp: newExp,
            dailyStreak: newStreak,
            lastDailyClaimDate: todayKey,
            lastDailyExpGained: expGained,
            rankTitle: newRankInfo.current.name,
            lastDailyClaimAt: serverTimestamp()
        });
    } catch (e) {
        console.warn("Could not sync daily login reward to DB:", e);
    }

    // Refresh UI in Modal & Profile Card
    updateProfileRankAndDailyLoginUI(userProfile);

    if (elements.dailyModalCurrentEmblem) {
        elements.dailyModalCurrentEmblem.innerHTML = renderFreeFireRankSvg(newRankInfo.current);
    }
    if (elements.dailyModalCurrentRankName) {
        elements.dailyModalCurrentRankName.textContent = newRankInfo.current.name.toUpperCase();
    }
    if (elements.dailyModalCurrentExpBadge) {
        elements.dailyModalCurrentExpBadge.textContent = newRankInfo.next
            ? `${newRankInfo.exp} / ${newRankInfo.current.maxExp} EXP (Next: ${newRankInfo.next.name})`
            : `${newRankInfo.exp} EXP (MAX RANK)`;
    }
    if (elements.dailyModalStreakCount) {
        elements.dailyModalStreakCount.innerHTML = `<i class="bi bi-fire text-warning"></i> ${newStreak} Day Strike`;
    }
    if (elements.dailyMysteryBoxStatusTitle) {
        elements.dailyMysteryBoxStatusTitle.textContent = `Awesome! You Got +${expGained} EXP! 🎉`;
    }
    if (elements.dailyMysteryBoxStatusDesc) {
        elements.dailyMysteryBoxStatusDesc.innerHTML = `Your Daily Strike is now <strong class="text-warning">${newStreak} Day${newStreak > 1 ? 's' : ''}</strong>! Come back tomorrow for your next box.`;
    }
    if (elements.claimDailyBoxBtn) {
        elements.claimDailyBoxBtn.disabled = true;
        elements.claimDailyBoxBtn.innerHTML = `<i class="bi bi-check2-all me-1"></i> Claimed Today (+${expGained} EXP)`;
    }

    renderAllRanksRoadmapGrid(newRankInfo.current.index, newRankInfo.exp);
    isOpeningDailyMysteryBox = false;

    // Check if user leveled up to the next Rank (e.g. 10/10 EXP -> Bronze II!)
    if (newRankInfo.current.index > oldRankInfo.current.index) {
        setTimeout(() => {
            showRankUpCelebrationOverlay(newRankInfo.current, false);
        }, 650);
    }
}

function toggleLoginForm(showLogin: boolean, preserveValues = true) {
    if (!elements.emailLoginForm || !elements.emailSignupForm) return;
    clearStatusMessage(elements.loginStatusMessage);
    clearStatusMessage(elements.signupStatusMessage);

    if (showLogin) {
        if (preserveValues && elements.signupEmailInput?.value) {
            elements.loginEmailInput.value = elements.signupEmailInput.value;
            elements.loginPasswordInput.value = elements.signupPasswordInput.value;
        }
        elements.emailLoginForm.style.display = 'block';
        elements.emailSignupForm.style.display = 'none';

        if (elements.tabSwitchLoginBtn && elements.tabSwitchSignupBtn) {
            elements.tabSwitchLoginBtn.className = 'btn btn-sm flex-fill rounded-2 fw-bold text-white';
            elements.tabSwitchLoginBtn.style.background = 'var(--primary-button-bg)';
            elements.tabSwitchSignupBtn.className = 'btn btn-sm flex-fill rounded-2 fw-bold text-secondary';
            elements.tabSwitchSignupBtn.style.background = 'transparent';
        }
    } else {
        if (preserveValues && elements.loginEmailInput?.value) {
            elements.signupEmailInput.value = elements.loginEmailInput.value;
            elements.signupPasswordInput.value = elements.loginPasswordInput.value;
            if (!elements.signupNameInput.value) {
                const nameFromEmail = elements.loginEmailInput.value.split('@')[0];
                elements.signupNameInput.value = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
            }
        }
        elements.emailLoginForm.style.display = 'none';
        elements.emailSignupForm.style.display = 'block';

        if (elements.tabSwitchLoginBtn && elements.tabSwitchSignupBtn) {
            elements.tabSwitchSignupBtn.className = 'btn btn-sm flex-fill rounded-2 fw-bold text-white';
            elements.tabSwitchSignupBtn.style.background = 'var(--primary-button-bg)';
            elements.tabSwitchLoginBtn.className = 'btn btn-sm flex-fill rounded-2 fw-bold text-secondary';
            elements.tabSwitchLoginBtn.style.background = 'transparent';
        }
    }
}

let isAuthActionInProgress = false;
let pendingSignupName: string | null = null;

async function signUpWithEmail() {
    if (!auth || isAuthActionInProgress) return;
    const name = elements.signupNameInput.value.trim();
    const em = elements.signupEmailInput.value.trim();
    const pw = elements.signupPasswordInput.value;
    if (!name || !em || !pw) {
        showStatusMessage(elements.signupStatusMessage, 'Name, Email and Password are required.', 'warning');
        return;
    }
    if (pw.length < 6) {
        showStatusMessage(elements.signupStatusMessage, 'Password must be at least 6 characters long.', 'warning');
        return;
    }
    isAuthActionInProgress = true;
    if (elements.signupEmailBtn) elements.signupEmailBtn.disabled = true;
    showLoader(true);
    clearStatusMessage(elements.signupStatusMessage);
    try {
        pendingSignupName = name;
        tempReferralCode = elements.signupReferralCodeInput.value.trim();
        await createUserWithEmailAndPassword(auth, em, pw);
    } catch (e: any) {
        pendingSignupName = null;
        console.warn("Signup Error:", e.code || e.message);
        let m = `Signup failed: ${e.message}`;
        if (e.code === 'auth/email-already-in-use') {
            m = `
                <div class="text-start">
                    <div class="fw-bold mb-1"><i class="bi bi-info-circle-fill me-1"></i> Email already registered</div>
                    <div class="small mb-2">An account already exists for <strong>${escapeHtml(em)}</strong>.</div>
                    <button type="button" class="btn btn-sm btn-outline-warning w-100 fw-bold" id="signupSwitchToLoginBtn">
                        <i class="bi bi-box-arrow-in-right me-1"></i> Switch to Login
                    </button>
                </div>`;
            showStatusMessage(elements.signupStatusMessage, m, 'warning', false);
            document.getElementById('signupSwitchToLoginBtn')?.addEventListener('click', () => {
                toggleLoginForm(true, true);
            });
            return;
        } else if (e.code === 'auth/weak-password') {
            m = 'Password is too weak. Please use at least 6 characters.';
        } else if (e.code === 'auth/invalid-email') {
            m = 'Please enter a valid email address.';
        }
        showStatusMessage(elements.signupStatusMessage, m, 'danger');
    } finally {
        isAuthActionInProgress = false;
        if (elements.signupEmailBtn) elements.signupEmailBtn.disabled = false;
        showLoader(false);
    }
}

async function loginWithEmail() {
    if (!auth || isAuthActionInProgress) return;
    const em = elements.loginEmailInput.value.trim();
    const pw = elements.loginPasswordInput.value;
    if (!em || !pw) {
        showStatusMessage(elements.loginStatusMessage, 'Please enter your email and password.', 'warning');
        return;
    }
    if (pw.length < 6) {
        showStatusMessage(elements.loginStatusMessage, 'Password must be at least 6 characters long.', 'warning');
        return;
    }
    isAuthActionInProgress = true;
    if (elements.loginEmailBtn) elements.loginEmailBtn.disabled = true;
    showLoader(true);
    clearStatusMessage(elements.loginStatusMessage);
    try {
        await signInWithEmailAndPassword(auth, em, pw);
    } catch (e: any) {
        const errorCode = e?.code || '';
        if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found') {
            console.warn("Login attempt with invalid credential for:", em);

            // Check if user profile already exists in DB to give crystal-clear feedback
            let emailExistsInDb = false;
            try {
                const userQ = query(ref(db, 'users'), orderByChild('email'), equalTo(em));
                const snap = await get(userQ);
                if (snap.exists()) {
                    emailExistsInDb = true;
                }
            } catch (dbErr) {
                // Ignore DB check error if any
            }

            if (emailExistsInDb) {
                const msgHtml = `
                    <div class="text-start">
                        <div class="fw-bold text-danger mb-1"><i class="bi bi-shield-lock-fill me-1"></i> Incorrect Password</div>
                        <div class="small text-white-50 mb-2">An account with <strong>${escapeHtml(em)}</strong> exists, but the password was incorrect.</div>
                        <button type="button" class="btn btn-sm btn-outline-warning w-100 fw-bold" id="loginResetPwActionBtn">
                            <i class="bi bi-envelope-check me-1"></i> Send Password Reset Email
                        </button>
                    </div>`;
                showStatusMessage(elements.loginStatusMessage, msgHtml, 'danger', false);
                document.getElementById('loginResetPwActionBtn')?.addEventListener('click', resetPassword);
            } else {
                const msgHtml = `
                    <div class="text-start">
                        <div class="fw-bold text-warning mb-1"><i class="bi bi-person-exclamation me-1"></i> Account Not Found</div>
                        <div class="small text-white-50 mb-2">No account was found for <strong>${escapeHtml(em)}</strong>. Create your account with 1 tap to join!</div>
                        <button type="button" class="btn btn-sm btn-custom-accent w-100 fw-bold py-2" id="loginCreateAccountActionBtn">
                            <i class="bi bi-person-plus-fill me-1"></i> Register Account for ${escapeHtml(em)}
                        </button>
                    </div>`;
                showStatusMessage(elements.loginStatusMessage, msgHtml, 'warning', false);
                document.getElementById('loginCreateAccountActionBtn')?.addEventListener('click', () => {
                    toggleLoginForm(false, true);
                    showStatusMessage(elements.signupStatusMessage, `Details transferred. Enter optional referral code & tap <strong>Register</strong>!`, 'info', false);
                });
            }
        } else if (errorCode === 'auth/wrong-password') {
            console.warn("Wrong password for:", em);
            const msgHtml = `
                <div class="text-start">
                    <div class="fw-bold text-danger mb-1"><i class="bi bi-shield-lock-fill me-1"></i> Incorrect Password</div>
                    <div class="small text-white-50 mb-2">The password for <strong>${escapeHtml(em)}</strong> was incorrect.</div>
                    <button type="button" class="btn btn-sm btn-outline-warning w-100 fw-bold" id="loginResetPwActionBtn">
                        <i class="bi bi-key-fill me-1"></i> Reset Password
                    </button>
                </div>`;
            showStatusMessage(elements.loginStatusMessage, msgHtml, 'danger', false);
            document.getElementById('loginResetPwActionBtn')?.addEventListener('click', resetPassword);
        } else if (errorCode === 'auth/too-many-requests') {
            console.warn("Too many login attempts for:", em);
            showStatusMessage(elements.loginStatusMessage, 'Too many unsuccessful login attempts. Please wait a few moments or reset your password.', 'warning', false);
        } else if (errorCode === 'auth/network-request-failed') {
            showStatusMessage(elements.loginStatusMessage, 'Network error. Please check your internet connection and try again.', 'danger');
        } else {
            console.warn("Login Error:", e);
            showStatusMessage(elements.loginStatusMessage, `Login failed: ${e.message}`, 'danger');
        }
    } finally {
        showLoader(false);
    }
}

async function resetPassword() {
    if (!auth) return;
    const em = elements.loginEmailInput.value.trim() || elements.signupEmailInput.value.trim();
    if (!em) {
        showStatusMessage(elements.loginStatusMessage, 'Enter your email address to receive password reset link.', 'warning');
        return;
    }
    showLoader(true);
    clearStatusMessage(elements.loginStatusMessage);
    try {
        await sendPasswordResetEmail(auth, em);
        showStatusMessage(elements.loginStatusMessage, `Password reset email sent to <strong>${escapeHtml(em)}</strong>! Please check your inbox and spam folder.`, 'success', false);
    } catch (e: any) {
        console.warn("Password reset error:", e);
        let msg = `Password reset failed: ${e.message}`;
        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
            msg = `No account found with <strong>${escapeHtml(em)}</strong>. Please click 'Sign Up' to create an account.`;
        }
        showStatusMessage(elements.loginStatusMessage, msg, 'danger', false);
    } finally {
        showLoader(false);
    }
}

async function logoutUser() {
    if (!auth) return;
    try {
        showLoader(true);
        if (currentUser && db && userProfile && (userProfile.uid || userProfile.email || userProfile.displayName)) {
            try {
                await update(ref(db, `users/${currentUser.uid}`), {
                    isOnline: false,
                    lastSeen: serverTimestamp()
                });
            } catch (e) {}
        }
        await signOut(auth);
    } catch (e: any) {
        alert(`Logout failed: ${e.message}`);
    } finally {
        showLoader(false);
    }
}

async function handleAuthStateChange(user: User | null) {
    if (!auth || !db) { showLoader(false); return; }
    showLoader(true);
    detachAllDbListeners();
    currentUser = user;
    const referralCodeFromSignup = tempReferralCode;
    tempReferralCode = null;
    const signupNameFromPending = pendingSignupName;
    pendingSignupName = null;

    if (user) {
        const userRef = ref(db, 'users/' + user.uid);
        try {
            await user.getIdToken().catch(() => {});
            let snapshot: any = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    snapshot = await get(userRef);
                    break;
                } catch (readErr: any) {
                    if (attempt === 2) throw readErr;
                    await new Promise((r) => setTimeout(r, 500));
                }
            }
            if (snapshot && snapshot.exists()) {
                const existing = snapshot.val() || {};
                const signupBonus = appSettings.signupBonus ?? 10;
                const nameFromInput = signupNameFromPending || elements.signupNameInput?.value?.trim();
                const displayName = existing.displayName || user.displayName || nameFromInput || user.email?.split('@')[0] || 'Player';

                const updates: any = {
                    lastLogin: serverTimestamp()
                };
                if (!existing.uid) updates.uid = user.uid;
                if (!existing.displayName) updates.displayName = displayName;
                if (!existing.email && user.email) updates.email = user.email;
                if (!existing.initialLeaderboardRank && !existing.createdAt) {
                    updates.createdAt = serverTimestamp();
                    updates.isNewUserAfter179 = true;
                }
                if (typeof existing.totalEarnings === 'undefined') updates.totalEarnings = 0;
                if (typeof existing.totalMatches === 'undefined') updates.totalMatches = 0;
                if (typeof existing.wonMatches === 'undefined') updates.wonMatches = 0;
                if (typeof existing.referralEarnings === 'undefined') updates.referralEarnings = 0;
                if (typeof existing.referralCount === 'undefined') updates.referralCount = 0;
                if (typeof existing.depositBalance === 'undefined') updates.depositBalance = 0;
                if (typeof existing.winningCash === 'undefined') updates.winningCash = 0;
                if (typeof existing.bonusCash === 'undefined') {
                    updates.bonusCash = signupBonus;
                    updates.balance = signupBonus;
                    updates.walletBalance = signupBonus;
                    if (signupBonus > 0) {
                        recordTransaction(user.uid, 'signup_bonus', signupBonus, `Welcome Bonus`).catch(() => {});
                    }
                }
                if (!existing.referralCode) updates.referralCode = generateReferralCode();
                if (typeof existing.likeCount === 'undefined') updates.likeCount = 0;
                if (existing.userDisabledNotifications !== true && existing.notificationsEnabled === false) {
                    updates.notificationsEnabled = true;
                }

                if (referralCodeFromSignup && !existing.referredBy) {
                    try {
                        const q = query(ref(db, 'users'), orderByChild('referralCode'), equalTo(referralCodeFromSignup));
                        const referrerSnapshot = await get(q);
                        if (referrerSnapshot.exists()) {
                            const referrerData = referrerSnapshot.val();
                            const referrerId = Object.keys(referrerData)[0];
                            const referrerProfile = referrerData[referrerId];

                            const pendingReferralRef = push(ref(db, 'pendingReferrals'));
                            await set(pendingReferralRef, {
                                referrerUid: referrerId,
                                referrerEmail: referrerProfile.email || null,
                                referredUid: user.uid,
                                referredEmail: user.email || null,
                                status: 'pending',
                                timestamp: serverTimestamp()
                            });
                            updates.referredBy = referrerId;
                        }
                    } catch (refErr) {
                        console.warn("Referral lookup error:", refErr);
                    }
                }

                await update(userRef, updates);
                userProfile = { ...existing, ...updates };
            } else {
                console.log("Creating new user profile...");
                const signupBonus = appSettings.signupBonus ?? 10;
                const displayName = signupNameFromPending || user.displayName || elements.signupNameInput.value.trim() || user.email?.split('@')[0] || 'Player';

                const newUserProfile: any = {
                    uid: user.uid,
                    displayName: displayName,
                    email: user.email || null,
                    photoURL: user.photoURL || null,
                    depositBalance: 0,
                    winningCash: 0,
                    bonusCash: signupBonus,
                    balance: signupBonus,
                    walletBalance: signupBonus,
                    totalMatches: 0,
                    wonMatches: 0,
                    totalEarnings: 0,
                    referralEarnings: 0,
                    referralCount: 0,
                    likeCount: 0,
                    createdAt: serverTimestamp(),
                    isNewUserAfter179: true,
                    referralCode: generateReferralCode(),
                    joinedTournaments: {},
                    isAdmin: false,
                    isPremium: false,
                    lastCheckedNotifications: Date.now(),
                    lastLogin: serverTimestamp()
                };

                if (referralCodeFromSignup) {
                    try {
                        const q = query(ref(db, 'users'), orderByChild('referralCode'), equalTo(referralCodeFromSignup));
                        const referrerSnapshot = await get(q);
                        if (referrerSnapshot.exists()) {
                            const referrerData = referrerSnapshot.val();
                            const referrerId = Object.keys(referrerData)[0];
                            const referrerProfile = referrerData[referrerId];

                            const pendingReferralRef = push(ref(db, 'pendingReferrals'));
                            await set(pendingReferralRef, {
                                referrerUid: referrerId,
                                referrerEmail: referrerProfile.email || null,
                                referredUid: user.uid,
                                referredEmail: user.email || null,
                                status: 'pending',
                                timestamp: serverTimestamp()
                            });
                            newUserProfile.referredBy = referrerId;
                            console.log(`Pending referral recorded for referrer ${referrerId}`);
                        }
                    } catch (refErr) {
                        console.warn("Referral lookup error:", refErr);
                    }
                }

                await set(userRef, newUserProfile);
                userProfile = newUserProfile;
                if (signupBonus > 0) {
                    await recordTransaction(user.uid, 'signup_bonus', signupBonus, `Welcome Bonus`);
                }
            }

    // Populate user info & refresh settings now that user is authenticated
            loadAppSettings().catch(() => {});
            populateUserInfo(user, userProfile);
            setupRealtimeListeners(user.uid);
            updateGlobalUI(true);
            loadAndDisplayNotifications();
            if (typeof window !== 'undefined') {
                setupPushNotifications(true).then((freshToken) => {
                    if (!freshToken) {
                        const savedToken = localStorage.getItem('erena_fcm_token');
                        if (savedToken && 'Notification' in window && Notification.permission === 'granted') {
                            update(ref(db, `users/${user.uid}`), {
                                fcmToken: savedToken,
                                notificationsEnabled: isNotificationsEnabled(userProfile),
                                fcmTokenUpdatedAt: serverTimestamp()
                            }).catch(() => {});
                            registerUserFcmToken(user.uid, savedToken).catch(() => {});
                        }
                    }
                }).catch(() => {});

                const askOnInteraction = () => {
                    setupPushNotifications(true).catch(() => {});
                    flushPendingSystemNotifications();
                };
                window.addEventListener('click', askOnInteraction, { once: true });
                window.addEventListener('touchend', askOnInteraction, { once: true });
            }

            const targetSection = (currentSectionId === 'login-section' || !getElement(currentSectionId)) ? 'home-section' : currentSectionId;
            showSection(targetSection);
        } catch (error: any) {
            console.error("Profile handling error:", error);
            alert("Error loading profile: " + error.message);
            await logoutUser();
        }
    } else {
        currentUser = null;
        userProfile = {};
        updateGlobalUI(false);
        showSection('login-section');
    }
    showLoader(false);
}

function applyTheme(theme: any) {
    if (!theme) return;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme)) {
        if (value) {
            root.style.setProperty(`--${key}`, String(value));
        }
    }
}

const DEFAULT_APP_SETTINGS = {
    appName: "Erena Esports",
    minWithdraw: 50,
    signupBonus: 10,
    referralBonus: 10,
    referLink: "https://erenaesports.netlify.app",
    supportContact: '9389660753',
    upiDetails: 'aashif4412@ibl',
    qrCodeUrl: 'https://iili.io/FsMJsRV.md.png'
};

async function loadAppSettings() {
    if (!appSettings || Object.keys(appSettings).length === 0) {
        appSettings = { ...DEFAULT_APP_SETTINGS };
    }
    if (!db) return;
    try {
        const settingsRef = ref(db, 'settings');
        const snapshot = await Promise.race([
            get(settingsRef).catch(() => null),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))
        ]);
        if (snapshot && snapshot.exists()) {
            appSettings = { ...DEFAULT_APP_SETTINGS, ...(snapshot.val() || {}) };
            if (appSettings.logoUrl && elements.appLogo) elements.appLogo.src = appSettings.logoUrl;
            if (appSettings.minWithdraw && elements.minWithdrawAmount) elements.minWithdrawAmount.textContent = appSettings.minWithdraw;
            if (appSettings.upiDetails && elements.modalUpiNumber) elements.modalUpiNumber.textContent = appSettings.upiDetails;
            if (appSettings.premiumThumbnailUrl && elements.premiumThumbnailImg) {
                elements.premiumThumbnailImg.src = appSettings.premiumThumbnailUrl;
            }
            if (appSettings.theme) {
                applyTheme(appSettings.theme);
            }
        }
    } catch {
        // Fallback to default settings already initialized
    }
}

function loadHomePageData() {
    if (!currentUser) {
        if (elements.promotionSlider?.querySelector('.swiper-wrapper')) elements.promotionSlider.querySelector('.swiper-wrapper')!.innerHTML = '';
        if (elements.gamesList) elements.gamesList.innerHTML = '';
        if (elements.myContestsList) elements.myContestsList.innerHTML = '<p class="text-secondary text-center">Login to view contests.</p>';
        return;
    }
    loadPromotions();
    loadGames();
    loadMyContests();
}

async function loadPromotions() {
    if (!elements.promotionSlider) return;
    const sliderWrapper = elements.promotionSlider.querySelector('.swiper-wrapper');
    if (!sliderWrapper) return;
    sliderWrapper.classList.add('placeholder-glow');
    sliderWrapper.innerHTML = `<div class="swiper-slide"><span class="placeholder" style="height: 100%; border-radius: 10px; display: block; width: 100%;"></span></div>`;

    const promoRef = ref(db, 'promotions');
    try {
        const snapshot = await get(promoRef);
        const promotions = snapshot.val() || {};
        const activePromotions = Object.values(promotions).filter((p: any) => p.imageUrl);
        removePlaceholders(elements.promotionSlider);
        sliderWrapper.innerHTML = '';

        if (activePromotions.length > 0) {
            elements.promotionSlider.style.display = 'block';
            activePromotions.forEach((promo: any) => {
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                slide.innerHTML = promo.link ? `<a href="${promo.link}" target="_blank"><img src="${promo.imageUrl}" alt="Promo"></a>` : `<img src="${promo.imageUrl}" alt="Promo">`;
                sliderWrapper.appendChild(slide);
            });
            if (swiperInstance) swiperInstance.destroy(true, true);
            swiperInstance = new Swiper(elements.promotionSlider, {
                loop: activePromotions.length > 1,
                autoplay: { delay: 3200, disableOnInteraction: false },
                pagination: { el: '.swiper-pagination', clickable: true },
                slidesPerView: 1,
                touchReleaseOnEdges: true,
                passiveListeners: true,
                touchStartPreventDefault: false,
                resistance: true,
                resistanceRatio: 0
            });
        } else {
            // Default exciting tournament promotion banner
            elements.promotionSlider.style.display = 'block';
            sliderWrapper.innerHTML = `
                <div class="swiper-slide"><img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800" alt="Esports Tournaments"></div>
                <div class="swiper-slide"><img src="https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800" alt="Win Big Prizes"></div>
            `;
            if (swiperInstance) swiperInstance.destroy(true, true);
            swiperInstance = new Swiper(elements.promotionSlider, {
                loop: true,
                autoplay: { delay: 3200, disableOnInteraction: false },
                pagination: { el: '.swiper-pagination', clickable: true },
                slidesPerView: 1,
                touchReleaseOnEdges: true,
                passiveListeners: true,
                touchStartPreventDefault: false,
                resistance: true,
                resistanceRatio: 0
            });
        }
    } catch (e) {
        console.error("Promo load failed:", e);
        removePlaceholders(elements.promotionSlider);
    }
}

async function loadGames() {
    if (!elements.gamesList) return;
    elements.gamesList.classList.add('placeholder-glow');
    const gamesRef = ref(db, 'games');
    try {
        const snapshot = await get(gamesRef);
        const games = snapshot.val() || {};
        let activeGames = Object.entries(games).filter(([, game]: any) => game.imageUrl && game.name);

        removePlaceholders(elements.gamesList);
        elements.gamesList.innerHTML = '';

        if (activeGames.length === 0) {
            // Provide default games if empty
            activeGames = [
                ['ff_clash', { name: 'Free Fire Battle Royale', imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=500' }],
                ['ff_cs', { name: 'Free Fire Clash Squad', imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=500' }]
            ];
        }

        if (!appSettings.games) appSettings.games = {};
        activeGames.forEach(([gameId, game]: any) => {
            appSettings.games[gameId] = { name: game.name };
            const col = document.createElement('div');
            col.className = 'col-6';
            col.innerHTML = `
                <div class="game-card custom-card" data-game-id="${gameId}" data-game-name="${game.name}">
                    <img src="${game.imageUrl}" alt="${game.name}">
                    <span>${game.name}</span>
                </div>`;
            col.querySelector('.game-card')?.addEventListener('click', () => {
                currentTournamentGameId = gameId;
                loadTournamentsForGame(gameId);
            });
            elements.gamesList.appendChild(col);
        });
    } catch (e) {
        console.error("Games load failed:", e);
        removePlaceholders(elements.gamesList);
        elements.gamesList.innerHTML = '<p class="text-danger text-center col-12">Could not load games.</p>';
    }
}

function loadTournamentsForGame(gameId: string) {
    if (!elements.tournamentsSection) return;
    currentTournamentGameId = gameId;
    elements.tournamentTabs.forEach(t => t.classList.remove('active'));
    querySel<HTMLButtonElement>('.tournament-tabs .tab-item[data-status="upcoming"]')?.classList.add('active');
    showSection('tournaments-section');
    filterTournaments(gameId, 'upcoming');
}

interface TournamentWinner {
    rank: number;
    username: string;
    uid?: string;
    kills: number;
    prize: number;
    killPrize: number;
    wonAmount: number;
    isCurrentUser: boolean;
    teammateUsername?: string;
}

function extractTournamentResults(tId: string, t: any) {
    if (!t) return { isAnnounced: false, winners: [] as TournamentWinner[], resultNote: '', userWonAmount: 0 };

    const isCompletedStatus = (t.status === 'completed' || t.status === 'result');
    const winnersList: TournamentWinner[] = [];
    const seenUids = new Set<string>();

    const addWinner = (w: Partial<TournamentWinner>) => {
        const username = String(w.username || 'Player').trim();
        const wonAmount = Number(w.wonAmount || 0);
        if (wonAmount <= 0 && (!w.rank || w.rank <= 0)) return;
        const uid = w.uid || '';
        if (uid && seenUids.has(uid)) return;
        if (uid) seenUids.add(uid);

        const isMe = Boolean(currentUser && uid && currentUser.uid === uid);
        winnersList.push({
            rank: Number(w.rank) || (winnersList.length + 1),
            username: username || (isMe ? 'You' : (uid ? `Player_${uid.slice(-4)}` : 'Player')),
            uid: uid || undefined,
            kills: Number(w.kills) || 0,
            prize: Number(w.prize) || 0,
            killPrize: Number(w.killPrize) || 0,
            wonAmount: wonAmount,
            isCurrentUser: isMe,
            teammateUsername: w.teammateUsername || ''
        });
    };

    // 1. Check t.winners (Array or Object)
    if (t.winners) {
        if (Array.isArray(t.winners)) {
            t.winners.forEach((w: any, idx: number) => {
                if (w && typeof w === 'object') {
                    addWinner({
                        rank: Number(w.rank || w.position || idx + 1),
                        username: w.username || w.displayName || w.name || w.playerName,
                        uid: w.uid || w.userId,
                        kills: Number(w.kills || 0),
                        prize: Number(w.prize || w.winning || w.winnings || 0),
                        killPrize: Number(w.killPrize || 0),
                        wonAmount: Number(w.wonAmount || w.totalWon || w.winning || w.winnings || w.prize || w.amount || w.won || 0),
                        teammateUsername: w.teammateUsername || w.teammateName
                    });
                }
            });
        } else if (typeof t.winners === 'object') {
            Object.entries(t.winners).forEach(([key, w]: [string, any]) => {
                if (w && typeof w === 'object') {
                    addWinner({
                        rank: Number(w.rank || key) || undefined,
                        username: w.username || w.displayName || w.name || w.playerName,
                        uid: w.uid || w.userId || (key.length > 10 ? key : undefined),
                        kills: Number(w.kills || 0),
                        prize: Number(w.prize || w.winning || w.winnings || 0),
                        killPrize: Number(w.killPrize || 0),
                        wonAmount: Number(w.wonAmount || w.totalWon || w.winning || w.winnings || w.prize || w.amount || w.won || 0),
                        teammateUsername: w.teammateUsername || w.teammateName
                    });
                }
            });
        }
    }

    // 2. Check t.results (Array or Object)
    if (t.results) {
        if (Array.isArray(t.results)) {
            t.results.forEach((w: any, idx: number) => {
                if (w && typeof w === 'object') {
                    addWinner({
                        rank: Number(w.rank || w.position || idx + 1),
                        username: w.username || w.displayName || w.name || w.playerName,
                        uid: w.uid || w.userId,
                        kills: Number(w.kills || 0),
                        prize: Number(w.prize || w.winning || w.winnings || 0),
                        killPrize: Number(w.killPrize || 0),
                        wonAmount: Number(w.wonAmount || w.totalWon || w.winning || w.winnings || w.prize || w.amount || w.won || 0),
                        teammateUsername: w.teammateUsername || w.teammateName
                    });
                }
            });
        } else if (typeof t.results === 'object') {
            Object.entries(t.results).forEach(([key, w]: [string, any]) => {
                if (w && typeof w === 'object') {
                    addWinner({
                        rank: Number(w.rank || key) || undefined,
                        username: w.username || w.displayName || w.name || w.playerName,
                        uid: w.uid || w.userId || (key.length > 10 ? key : undefined),
                        kills: Number(w.kills || 0),
                        prize: Number(w.prize || w.winning || w.winnings || 0),
                        killPrize: Number(w.killPrize || 0),
                        wonAmount: Number(w.wonAmount || w.totalWon || w.winning || w.winnings || w.prize || w.amount || w.won || 0),
                        teammateUsername: w.teammateUsername || w.teammateName
                    });
                }
            });
        }
    }

    // 3. Check t.registeredPlayers
    const regPlayers = t.registeredPlayers || {};
    for (const [uid, pData] of Object.entries<any>(regPlayers)) {
        if (!pData || typeof pData !== 'object') continue;
        const won = Number(pData.wonAmount || pData.totalWon || pData.winning || pData.winnings || pData.prize || pData.won || 0);
        const rank = pData.rank ? Number(pData.rank) : undefined;
        const kills = Number(pData.kills || 0);
        if (won > 0 || pData.isWinner === true || (rank && rank > 0 && isCompletedStatus)) {
            let finalWon = won;
            if (finalWon <= 0 && rank && t.prizeDistribution) {
                if (typeof t.prizeDistribution === 'object' && t.prizeDistribution[rank]) {
                    finalWon = Number(t.prizeDistribution[rank]) || 0;
                } else if (typeof t.prizeDistribution === 'string') {
                    const match = t.prizeDistribution.match(new RegExp(`Rank\\s*${rank}\\s*[:\\-]\\s*₹?([0-9.]+)`, 'i'));
                    if (match) finalWon = parseFloat(match[1]) || 0;
                }
                if (kills > 0 && t.perKillPrize) {
                    finalWon += kills * (Number(t.perKillPrize) || 0);
                }
            }
            if (finalWon > 0 || (rank && rank <= 3)) {
                addWinner({
                    rank: rank || (winnersList.length + 1),
                    username: pData.username || pData.displayName || pData.name,
                    uid: uid,
                    kills: kills,
                    prize: finalWon,
                    killPrize: kills * (Number(t.perKillPrize) || 0),
                    wonAmount: finalWon,
                    teammateUsername: pData.teammateUsername
                });
            }
        }
    }

    winnersList.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return b.wonAmount - a.wonAmount;
    });

    const isAnnounced = isCompletedStatus || winnersList.length > 0 || Boolean(t.result);

    let userWonAmount = 0;
    if (currentUser) {
        const myWinner = winnersList.find(w => w.uid === currentUser?.uid || w.isCurrentUser);
        if (myWinner) {
            userWonAmount = myWinner.wonAmount;
        } else if (userProfile?.matchHistory?.[tId]) {
            const mh = userProfile.matchHistory[tId];
            userWonAmount = Number(mh.earnings ?? mh.wonAmount ?? mh.prize ?? 0);
        } else if (regPlayers[currentUser.uid]) {
            const myReg = regPlayers[currentUser.uid];
            userWonAmount = Number(myReg.wonAmount || myReg.totalWon || myReg.winning || myReg.winnings || myReg.prize || myReg.won || 0);
        }
    }

    const resultNote = String(t.resultText || (typeof t.result === 'string' ? t.result : '') || t.adminResultNote || t.notes || '').trim();

    return {
        isAnnounced,
        winners: winnersList,
        resultNote,
        userWonAmount
    };
}

async function filterTournaments(gameId: string, status: string) {
    if (!elements.tournamentsListContainer) return;
    elements.tournamentsListContainer.innerHTML = '';
    elements.tournamentsListContainer.classList.add('placeholder-glow');
    elements.tournamentsListContainer.innerHTML = `<div class="tournament-card placeholder-glow mb-3"><div class="tournament-card-content"><span class="placeholder col-6"></span><span class="placeholder col-12 mt-2"></span></div></div>`;
    elements.noTournamentsMessage.style.display = 'none';

    try {
        const tQuery = query(ref(db, 'tournaments'), orderByChild('gameId'), equalTo(gameId));
        const s = await get(tQuery);
        const allT = s.val() || {};
        const fT = Object.entries(allT).filter(([, t]: any) => {
            if (status === 'completed') {
                return t.status === 'completed' || t.status === 'result';
            }
            return t.status === status;
        }).sort(([, tA]: any, [, tB]: any) => {
            if (status === 'completed') {
                return (tB.startTime || 0) - (tA.startTime || 0);
            }
            return (tA.startTime || 0) - (tB.startTime || 0);
        });

        removePlaceholders(elements.tournamentsListContainer);
        elements.tournamentsListContainer.innerHTML = '';

        if (fT.length > 0) {
            fT.forEach(([tId, t]: any) => {
                const card = createTournamentCardElement(tId, t);
                elements.tournamentsListContainer.appendChild(card);
            });
        } else {
            elements.noTournamentsMessage.style.display = 'block';
            elements.noTournamentsMessage.textContent = `No ${status === 'completed' ? 'result' : status} tournaments found.`;
        }
    } catch (e) {
        console.error(`Tournaments filter failed:`, e);
        removePlaceholders(elements.tournamentsListContainer);
        elements.noTournamentsMessage.style.display = 'block';
    }
}

function createTournamentCardElement(tId: string, t: any) {
    const card = document.createElement('div');
    card.className = 'tournament-card';
    card.dataset.tournamentId = tId;

    const bannerUrl = t.bannerUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800';
    const eFee = t.entryFee || 0;
    const pkPrize = t.perKillPrize || 0;
    const pPool = t.prizePool || 0;
    const sTime = t.startTime ? new Date(t.startTime) : null;
    const sTimeLoc = sTime ? sTime.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'TBA';
    const regP = t.registeredPlayers || {};
    const regC = Object.keys(regP).length;
    const maxP = t.maxPlayers || 0;
    const spotsL = maxP > 0 ? Math.max(0, maxP - regC) : Infinity;
    const isF = maxP > 0 && spotsL <= 0;
    const isJ = currentUser && userProfile?.joinedTournaments?.[tId];
    const canJ = !isJ && !isF && t.status === 'upcoming';

    const matchResults = extractTournamentResults(tId, t);
    const isCompletedOrResult = (t.status === 'completed' || t.status === 'result' || matchResults.isAnnounced);

    let timerTxt = t.status?.toUpperCase() || 'N/A';
    if (isCompletedOrResult) {
        timerTxt = '<span class="text-success fw-bold"><i class="bi bi-trophy-fill me-1"></i>RESULT ANNOUNCED</span>';
    } else if (t.status === 'upcoming' && sTime) {
        timerTxt = getTimeRemaining(t.startTime);
    } else if (t.status === 'ongoing') {
        timerTxt = 'LIVE';
    }

    let spotsTxt = 'Unlimited Spots';
    let progP = 0;
    if (maxP > 0) {
        spotsTxt = `<span class="${spotsL <= 5 ? 'text-danger' : 'text-accent'}">${spotsL}</span> Spots Left (${regC}/${maxP})`;
        progP = Math.min(100, (regC / maxP) * 100);
    }

    let joinBtnHtml = '';
    let idPassBtn = '';
    let chatBtnHtml = '';
    let resultBannerHtml = '';

    if (isCompletedOrResult) {
        // Tournament is completed / results announced
        if (matchResults.winners.length > 0) {
            const topWinner = matchResults.winners[0];
            const moreCount = matchResults.winners.length - 1;
            resultBannerHtml = `
                <div class="result-winner-banner mt-2 p-2 rounded" style="background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.4);">
                    <div class="d-flex align-items-center justify-content-between">
                        <span class="small fw-bold text-success"><i class="bi bi-trophy-fill text-warning me-1"></i>Winners Announced</span>
                        <span class="badge bg-success">${matchResults.winners.length} Winner${matchResults.winners.length > 1 ? 's' : ''}</span>
                    </div>
                    <div class="small text-light mt-1 text-truncate">
                        🥇 1st Place: <strong class="text-warning">${escapeHtml(topWinner.username)}</strong> (Won <strong class="text-success">₹${topWinner.wonAmount}</strong>)
                        ${moreCount > 0 ? `<span class="text-secondary ms-1">(+${moreCount} more)</span>` : ''}
                    </div>
                </div>
            `;
        }

        if (matchResults.userWonAmount > 0) {
            resultBannerHtml += `
                <div class="mt-2 p-1.5 px-2 rounded text-center bg-success bg-opacity-25 border border-success text-success fw-bold small">
                    <i class="bi bi-award-fill me-1"></i>🎉 Congratulations! You Won ₹${matchResults.userWonAmount.toFixed(2)}!
                </div>
            `;
        }

        joinBtnHtml = `<button class="btn btn-custom btn-custom-accent btn-sm btn-details w-100" data-tournament-id="${tId}"><i class="bi bi-trophy-fill me-1"></i>See Details & Results</button>`;
    } else if (isJ) {
        joinBtnHtml = `<button class="btn btn-custom btn-sm btn-joined" disabled><i class="bi bi-check-circle-fill"></i> Joined</button>`;
        if (t.status === 'ongoing' || (t.status === 'upcoming' && t.showIdPass && sTime && Date.now() > sTime.getTime() - 900000)) {
            idPassBtn = `<button class="btn btn-custom btn-idpass w-100 mt-2 btn-sm" data-tournament-id="${tId}"><i class="bi bi-key-fill"></i> View ID & Pass</button>`;
        }
        if (t.status === 'ongoing' || t.status === 'upcoming') {
            chatBtnHtml = `<button class="btn btn-custom btn-custom-secondary btn-sm btn-chat" data-tournament-id="${tId}" data-tournament-name="${t.name || 'Tournament'}"><i class="bi bi-chat-dots-fill"></i> Chat</button>`;
        }
    } else if (canJ) {
        const mode = t.mode || 'Solo';
        joinBtnHtml = `<button class="btn btn-custom btn-sm btn-custom-accent btn-join" data-tournament-id="${tId}" data-fee="${eFee}" data-mode="${mode}">₹${eFee} Join <i class="bi bi-arrow-right-short"></i></button>`;
    } else {
        const disR = t.status !== 'upcoming' ? t.status?.toUpperCase() : (isF ? 'Full' : 'Closed');
        joinBtnHtml = `<button class="btn btn-custom btn-sm btn-disabled" disabled>${disR || 'N/A'}</button>`;
    }

    const actionButtonsHtml = isCompletedOrResult
        ? `<div class="tournament-card-actions">${joinBtnHtml}</div>`
        : `
            <div class="tournament-card-actions">
                <button class="btn btn-custom btn-custom-secondary btn-sm btn-details" data-tournament-id="${tId}">Details</button>
                ${chatBtnHtml}
                ${joinBtnHtml}
            </div>
            ${idPassBtn}
        `;

    card.innerHTML = `
        <img src="${bannerUrl}" alt="Tournament Banner" class="tournament-banner-image">
        <div class="tournament-card-content">
            <div class="tournament-card-header">
                <div class="tournament-card-tags">
                    ${t.mode ? `<span>${t.mode}</span>` : ''}
                    ${t.map ? `<span>${t.map}</span>` : ''}
                </div>
                <div class="tournament-card-timer">${timerTxt}</div>
            </div>
            <h3 class="tournament-card-title"><i class="bi bi-joystick text-accent"></i> ${t.name || 'Tournament'}</h3>
            <p class="small text-secondary mb-2"><i class="bi bi-calendar-event"></i> ${sTimeLoc}</p>
            <div class="tournament-card-info">
                <div class="info-item"><span>Prize Pool</span><strong><i class="bi bi-trophy-fill text-accent prize-icon"></i> ₹${pPool}</strong></div>
                <div class="info-item"><span>Per Kill</span><strong>₹${pkPrize}</strong></div>
                <div class="info-item"><span>Entry Fee</span><strong class="${eFee > 0 ? 'text-info' : ''}">${eFee > 0 ? `₹${eFee}` : 'Free'}</strong></div>
            </div>
            <div class="tournament-card-spots">${spotsTxt}${maxP > 0 ? `<div class="progress mt-1" style="height: 6px;"><div class="progress-bar bg-warning" role="progressbar" style="width: ${progP}%"></div></div>` : ''}</div>
            ${resultBannerHtml}
            ${actionButtonsHtml}
        </div>`;

    card.querySelector('.btn-join')?.addEventListener('click', handleJoinTournamentClick);
    card.querySelectorAll('.btn-details').forEach(btn => btn.addEventListener('click', handleMatchDetailsClick));
    card.querySelector('.btn-idpass')?.addEventListener('click', handleIdPasswordClick);
    card.querySelector('.btn-chat')?.addEventListener('click', (e: any) => openTournamentChat(e.currentTarget.dataset.tournamentId, e.currentTarget.dataset.tournamentName));
    return card;
}

async function loadMyContests() {
    if (!currentUser || !elements.myContestsList) return;
    const joinedIds = Object.keys(userProfile.joinedTournaments || {});
    if (joinedIds.length === 0) {
        removePlaceholders(elements.myContestsList);
        elements.myContestsList.innerHTML = '';
        if (elements.noContestsMessage) elements.noContestsMessage.style.display = 'block';
        return;
    }
    if (elements.noContestsMessage) elements.noContestsMessage.style.display = 'none';

    try {
        const contestPromises = joinedIds.map(id => get(ref(db, `tournaments/${id}`)));
        const snapshots = await Promise.all(contestPromises);
        removePlaceholders(elements.myContestsList);
        elements.myContestsList.innerHTML = '';
        const contestCards: any[] = [];
        snapshots.forEach((snapshot, index) => {
            if (snapshot.exists()) {
                const t = snapshot.val();
                const isCompleted = (t.status === 'completed' || t.status === 'result');
                if (t.status === 'upcoming' || t.status === 'ongoing' || isCompleted) {
                    const tId = joinedIds[index];
                    contestCards.push({ 
                        startTime: t.startTime || 0, 
                        isCompleted,
                        card: createTournamentCardElement(tId, t) 
                    });
                }
            }
        });
        contestCards.sort((a, b) => {
            if (a.isCompleted !== b.isCompleted) {
                return a.isCompleted ? 1 : -1;
            }
            return a.startTime - b.startTime;
        });
        if (contestCards.length > 0) {
            contestCards.forEach(item => elements.myContestsList.appendChild(item.card));
        } else if (elements.noContestsMessage) {
            elements.noContestsMessage.style.display = 'block';
        }
    } catch (e) {
        console.error("My contests load failed:", e);
    }
}

function loadWalletData() {
    if (!currentUser) return;
    loadRecentTransactions();
}

function loadProfileData() {
    if (!currentUser) return;
    if (userProfile?.displayName) {
        removePlaceholders(elements.profileName?.closest('.placeholder-glow'));
        removePlaceholders(elements.profileEmail?.closest('.placeholder-glow'));
        removePlaceholders(elements.profileTotalMatches?.closest('.placeholder-glow'));
        removePlaceholders(elements.profileWonMatches?.closest('.placeholder-glow'));
        removePlaceholders(elements.profileTotalEarnings?.closest('.placeholder-glow'));
    }
}

function loadEarningsData() {
    if (!currentUser) return;
    if (typeof userProfile?.totalEarnings !== 'undefined') removePlaceholders(elements.earningsTotal?.closest('.placeholder-glow'));
    if (typeof userProfile?.referralEarnings !== 'undefined') removePlaceholders(elements.earningsReferral?.closest('.placeholder-glow'));
}

/* =========================================================
   LEADERBOARD (2 TABS: TOP PLAYERS & TOP REFERRALS) + LIKES
   ========================================================= */
const leaderboardStatsCache: Record<string, {
    rank: number;
    isInitial179: boolean;
    totalEarnings: number;
    totalMatches: number;
    wonMatches: number;
}> = {};
let isFetchingLeaderboardStatsCache = false;

function extractLeaderboardUsersFromSnapshot(snapshot: any): any[] {
    const allUsers: any[] = [];
    const seenUids = new Set<string>();
    const seenNewUserEmails = new Set<string>();

    if (snapshot && snapshot.exists()) {
        snapshot.forEach((child: any) => {
            const u = child.val();
            if (u && typeof u === 'object') {
                const uid = child.key || u.uid || '';
                const hasRealIdentity = Boolean(
                    (u.displayName && String(u.displayName).trim()) ||
                    (u.username && String(u.username).trim()) ||
                    (u.name && String(u.name).trim()) ||
                    (u.email && String(u.email).trim()) ||
                    Number(u.initialLeaderboardRank) > 0
                );
                if (!hasRealIdentity) return;

                const isInitial = Number(u.initialLeaderboardRank) >= 1 && Number(u.initialLeaderboardRank) <= 180 && u.isNewUserAfter179 !== true;
                if (!isInitial && !u.createdAt && !u.referralCode && uid !== currentUser?.uid) {
                    return;
                }
                const normEmail = String(u.email || '').trim().toLowerCase();
                if (!isInitial && normEmail && normEmail.includes('@')) {
                    if (seenNewUserEmails.has(normEmail)) return;
                    seenNewUserEmails.add(normEmail);
                }

                if (uid && !seenUids.has(uid)) {
                    seenUids.add(uid);
                    const displayName = (u.displayName && String(u.displayName).trim())
                        || (u.username && String(u.username).trim())
                        || (u.name && String(u.name).trim())
                        || (u.email && String(u.email).trim() ? String(u.email).split('@')[0] : '')
                        || `Player_${uid.slice(-4)}`;

                    allUsers.push({
                        ...u,
                        uid: uid,
                        displayName: displayName,
                        initialLeaderboardRank: Number(u.initialLeaderboardRank) || 0,
                        totalEarnings: Number(u.totalEarnings) || 0,
                        winningCash: Number(u.winningCash) || 0,
                        depositBalance: Number(u.depositBalance) || 0,
                        bonusCash: Number(u.bonusCash) || 0,
                        totalMatches: Number(u.totalMatches) || 0,
                        wonMatches: Number(u.wonMatches) || 0,
                        referralCount: Number(u.referralCount) || 0,
                        referralEarnings: Number(u.referralEarnings) || 0,
                        createdAt: u.createdAt || 0,
                        lastLogin: u.lastLogin || 0
                    });
                }
            }
        });
    }

    if (currentUser && !seenUids.has(currentUser.uid)) {
        seenUids.add(currentUser.uid);
        const myName = (userProfile?.displayName && String(userProfile.displayName).trim())
            || (userProfile?.username && String(userProfile.username).trim())
            || (currentUser.displayName && String(currentUser.displayName).trim())
            || (currentUser.email ? currentUser.email.split('@')[0] : '')
            || 'Player';

        allUsers.push({
            ...userProfile,
            uid: currentUser.uid,
            displayName: myName,
            initialLeaderboardRank: Number(userProfile?.initialLeaderboardRank) || 0,
            totalEarnings: Number(userProfile?.totalEarnings) || 0,
            winningCash: Number(userProfile?.winningCash) || 0,
            depositBalance: Number(userProfile?.depositBalance) || 0,
            bonusCash: Number(userProfile?.bonusCash) || 0,
            totalMatches: Number(userProfile?.totalMatches) || 0,
            wonMatches: Number(userProfile?.wonMatches) || 0,
            referralCount: Number(userProfile?.referralCount) || 0,
            referralEarnings: Number(userProfile?.referralEarnings) || 0,
            createdAt: userProfile?.createdAt || 0,
            lastLogin: userProfile?.lastLogin || 0
        });
    }

    return allUsers;
}

function applyTop180LeaderboardStats(allUsers: any[]): { initial179Users: any[]; newUsersAfter179: any[] } {
    const taggedInitialUsers = allUsers.filter(u => u.initialLeaderboardRank >= 1 && u.initialLeaderboardRank <= 180 && u.isNewUserAfter179 !== true);
    let initial179Users: any[] = [];
    let newUsersAfter179: any[] = [];

    if (taggedInitialUsers.length > 0) {
        initial179Users = taggedInitialUsers.sort((a, b) => a.initialLeaderboardRank - b.initialLeaderboardRank);
        const initialUidSet = new Set(initial179Users.map(u => u.uid));
        newUsersAfter179 = allUsers.filter(u => !initialUidSet.has(u.uid));
    } else {
        const explicitNewUsers = allUsers.filter(u => u.isNewUserAfter179 === true);
        const candidateInitialUsers = allUsers.filter(u => u.isNewUserAfter179 !== true);

        if (candidateInitialUsers.length <= 180) {
            initial179Users = candidateInitialUsers;
            newUsersAfter179 = explicitNewUsers;
        } else {
            const sortedByCreation = [...candidateInitialUsers].sort((a, b) => {
                const cA = Number(a.createdAt) || 0;
                const cB = Number(b.createdAt) || 0;
                if (cA !== cB) return cA - cB;
                return String(a.uid).localeCompare(String(b.uid));
            });
            initial179Users = sortedByCreation.slice(0, 180);
            newUsersAfter179 = [...sortedByCreation.slice(180), ...explicitNewUsers];
        }

        initial179Users.sort((a, b) => {
            const earnDiff = (b.totalEarnings || 0) - (a.totalEarnings || 0);
            if (earnDiff !== 0) return earnDiff;
            const winDiff = (b.wonMatches || 0) - (a.wonMatches || 0);
            if (winDiff !== 0) return winDiff;
            const matchDiff = (b.totalMatches || 0) - (a.totalMatches || 0);
            if (matchDiff !== 0) return matchDiff;
            const timeB = b.createdAt || b.lastLogin || 0;
            const timeA = a.createdAt || a.lastLogin || 0;
            if (timeB !== timeA) return (timeB > timeA ? 1 : -1);
            return a.displayName.localeCompare(b.displayName);
        });
    }

    initial179Users.forEach((u, idx) => {
        const rankNum = (u.initialLeaderboardRank >= 1 && u.initialLeaderboardRank <= 180) ? u.initialLeaderboardRank : (idx + 1);
        const fixed = getLeaderboardFixedStatsForRank(rankNum);
        u.topPlayersRank = rankNum;
        u.isInitial179 = true;
        u.displayTotalEarnings = fixed.totalEarnings;
        u.displayTotalMatches = fixed.totalMatches;
        u.displayWonMatches = fixed.wonMatches;
        if (u.uid) {
            leaderboardStatsCache[u.uid] = {
                rank: rankNum,
                isInitial179: true,
                totalEarnings: fixed.totalEarnings,
                totalMatches: fixed.totalMatches,
                wonMatches: fixed.wonMatches
            };
        }
    });

    newUsersAfter179.sort((a, b) => {
        const earnDiff = (b.totalEarnings || 0) - (a.totalEarnings || 0);
        if (earnDiff !== 0) return earnDiff;
        const winDiff = (b.wonMatches || 0) - (a.wonMatches || 0);
        if (winDiff !== 0) return winDiff;
        const matchDiff = (b.totalMatches || 0) - (a.totalMatches || 0);
        if (matchDiff !== 0) return matchDiff;
        const cA = Number(a.createdAt) || 0;
        const cB = Number(b.createdAt) || 0;
        if (cA !== cB) return cA - cB;
        return a.displayName.localeCompare(b.displayName);
    });

    newUsersAfter179.forEach((u, idx) => {
        const rankNum = initial179Users.length + idx + 1;
        u.topPlayersRank = rankNum;
        u.isInitial179 = false;
        u.displayTotalEarnings = Number(u.totalEarnings) || 0;
        u.displayTotalMatches = Number(u.totalMatches) || 0;
        u.displayWonMatches = Number(u.wonMatches) || 0;
        if (u.uid) {
            leaderboardStatsCache[u.uid] = {
                rank: rankNum,
                isInitial179: false,
                totalEarnings: u.displayTotalEarnings,
                totalMatches: u.displayTotalMatches,
                wonMatches: u.displayWonMatches
            };
        }
    });

    return { initial179Users, newUsersAfter179 };
}

function getEffectiveUserStats(uid: string, profile: any): {
    isTop180: boolean;
    rank: number;
    totalEarnings: number;
    totalMatches: number;
    wonMatches: number;
} {
    if (uid && leaderboardStatsCache[uid]) {
        const cached = leaderboardStatsCache[uid];
        if (cached.isInitial179) {
            return {
                isTop180: true,
                rank: cached.rank,
                totalEarnings: cached.totalEarnings,
                totalMatches: cached.totalMatches,
                wonMatches: cached.wonMatches
            };
        }
        return {
            isTop180: false,
            rank: cached.rank,
            totalEarnings: Number(profile?.totalEarnings) || 0,
            totalMatches: Number(profile?.totalMatches) || 0,
            wonMatches: Number(profile?.wonMatches) || 0
        };
    }

    if (profile && profile.isInitial179 && typeof profile.displayTotalEarnings === 'number') {
        return {
            isTop180: true,
            rank: Number(profile.topPlayersRank || profile.initialLeaderboardRank) || 1,
            totalEarnings: profile.displayTotalEarnings,
            totalMatches: Number(profile.displayTotalMatches) || 0,
            wonMatches: Number(profile.displayWonMatches) || 0
        };
    }

    const initialRank = Number(profile?.initialLeaderboardRank) || 0;
    if (initialRank >= 1 && initialRank <= 180 && profile?.isNewUserAfter179 !== true) {
        const fixed = getLeaderboardFixedStatsForRank(initialRank);
        return {
            isTop180: true,
            rank: initialRank,
            totalEarnings: fixed.totalEarnings,
            totalMatches: fixed.totalMatches,
            wonMatches: fixed.wonMatches
        };
    }

    if (Number(profile?.totalEarnings) === 26000 && profile?.isNewUserAfter179 !== true) {
        const fixed = getLeaderboardFixedStatsForRank(1);
        return {
            isTop180: true,
            rank: 1,
            totalEarnings: fixed.totalEarnings,
            totalMatches: fixed.totalMatches,
            wonMatches: fixed.wonMatches
        };
    }

    return {
        isTop180: false,
        rank: 0,
        totalEarnings: Number(profile?.totalEarnings) || 0,
        totalMatches: Number(profile?.totalMatches) || 0,
        wonMatches: Number(profile?.wonMatches) || 0
    };
}

async function ensureLeaderboardStatsCacheLoaded() {
    if (!db || isFetchingLeaderboardStatsCache) return;
    isFetchingLeaderboardStatsCache = true;
    try {
        const snap = await get(ref(db, 'users'));
        if (snap.exists()) {
            const allUsers = extractLeaderboardUsersFromSnapshot(snap);
            applyTop180LeaderboardStats(allUsers);
            if (currentUser && userProfile) {
                populateUserInfo(currentUser, userProfile);
            }
        }
    } catch {} finally {
        isFetchingLeaderboardStatsCache = false;
    }
}
function getLeaderboardFixedStatsForRank(rank: number): { totalEarnings: number; totalMatches: number; wonMatches: number } {
    let earnings = 16575;

    for (let r = 2; r <= rank; r++) {
        const seed1 = ((r * 1103515245 + 12345) >>> 0) % 1000;
        let earnDrop = 48 + (seed1 % 81); // 48..128 random-looking drop per rank down to 180
        if ((earnings - earnDrop) % 10 === 0) earnDrop += 3;
        earnings = Math.max(95, earnings - earnDrop);
    }

    const h1 = (((rank * 2654435761) ^ (rank * 1597334677)) >>> 0) % 1000;
    const h2 = (((rank * 1664525 + 1013904223) ^ (rank * 2246822519)) >>> 0) % 1000;
    const progress = Math.min(1, Math.max(0, (rank - 1) / 179));
    const baseWon = Math.round(115 - progress * 98);
    const wonJitter = (h1 % 31) - 15;
    const won = Math.max(6, baseWon + wonJitter);
    const extraMatches = 18 + (h2 % 67);
    const matches = won + extraMatches;

    return { totalEarnings: earnings, totalMatches: matches, wonMatches: won };
}

async function loadLeaderboardData() {
    if (!currentUser) return;
    const listEl = elements.leaderboardListEl;
    const emptyMsgEl = elements.noLeaderboardMessageEl;

    listEl.innerHTML = `
        <div class="leaderboard-item placeholder-glow mb-2">
            <span class="placeholder col-1" style="height: 30px; width: 35px;"></span>
            <span class="placeholder col-2 ms-2 me-3" style="height: 45px; width: 45px; border-radius: 50%;"></span>
            <div style="flex-grow: 1;"><span class="placeholder col-6 d-block" style="height: 20px;"></span></div>
            <span class="placeholder col-3" style="height: 20px;"></span>
        </div>`.repeat(5);
    emptyMsgEl.style.display = 'none';

    // Show/hide referral prize banner based on current tab
    if (elements.referralPrizeBanner) {
        elements.referralPrizeBanner.style.display = (currentLeaderboardTab === 'referrals') ? 'block' : 'none';
    }
    if (elements.leaderboardSectionTitle) {
        elements.leaderboardSectionTitle.textContent = (currentLeaderboardTab === 'referrals') ? 'Top Referrals Leaderboard' : 'Top Players Leaderboard';
    }

    // Clean up any existing realtime leaderboard listener
    if (dbListeners['leaderboardUsers']) {
        try {
            if (typeof dbListeners['leaderboardUsers'].func === 'function') {
                dbListeners['leaderboardUsers'].func();
            }
            off(ref(db, 'users'), 'value', dbListeners['leaderboardUsers'].func);
        } catch (e) {}
        delete dbListeners['leaderboardUsers'];
    }

    try {
        const usersRef = ref(db, 'users');
        const unsub = onValue(usersRef, (snapshot) => {
            removePlaceholders(listEl);
            listEl.innerHTML = '';

            const allUsers = extractLeaderboardUsersFromSnapshot(snapshot);

            if (allUsers.length === 0) {
                emptyMsgEl.style.display = 'block';
                return;
            }
            emptyMsgEl.style.display = 'none';

            // Always compute Top 180 stats so both Top Players and Top Referrals (and Profile) show the exact same stats
            const { initial179Users, newUsersAfter179 } = applyTop180LeaderboardStats(allUsers);
            if (currentUser && userProfile) {
                populateUserInfo(currentUser, userProfile);
            }

            if (currentLeaderboardTab === 'referrals') {
                // Sort by referral count or referral earnings, then displayed earnings, then name
                allUsers.sort((a, b) => {
                    const countA = a.referralCount || (a.referralEarnings ? a.referralEarnings / 10 : 0) || 0;
                    const countB = b.referralCount || (b.referralEarnings ? b.referralEarnings / 10 : 0) || 0;
                    const diff = countB - countA;
                    if (diff !== 0) return diff;
                    const earnDiff = (b.displayTotalEarnings ?? b.totalEarnings ?? 0) - (a.displayTotalEarnings ?? a.totalEarnings ?? 0);
                    if (earnDiff !== 0) return earnDiff;
                    return a.displayName.localeCompare(b.displayName);
                });
            } else {
                allUsers.length = 0;
                allUsers.push(...initial179Users, ...newUsersAfter179);
            }

            // Render ALL users so every single user in the app is displayed
            allUsers.forEach((user, index) => {
                const rank = index + 1;
                const displayName = user.displayName || user.email?.split('@')[0] || `Player ${rank}`;
                const photoURL = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1E293B&color=E2E8F0&bold=true&size=45`;

                const shownEarnings = user.isInitial179
                    ? user.displayTotalEarnings
                    : (user.totalEarnings || 0);
                const shownMatches = user.isInitial179
                    ? user.displayTotalMatches
                    : (user.totalMatches || 0);
                const shownWon = user.isInitial179
                    ? user.displayWonMatches
                    : (user.wonMatches || 0);

                let rightColHtml = '';

                if (currentLeaderboardTab === 'referrals') {
                    const count = user.referralCount || Math.floor((user.referralEarnings || 0) / 10) || 0;
                    if (rank === 1) {
                        rightColHtml = `
                            <div class="leaderboard-prize-col rank-1">
                                <span class="prize-val">🏆 ₹100</span>
                                <span class="prize-label">1st Prize</span>
                                <span class="referral-count">${count} Invites</span>
                            </div>
                        `;
                    } else if (rank === 2) {
                        rightColHtml = `
                            <div class="leaderboard-prize-col rank-2">
                                <span class="prize-val">🥈 ₹50</span>
                                <span class="prize-label">2nd Prize</span>
                                <span class="referral-count">${count} Invites</span>
                            </div>
                        `;
                    } else if (rank === 3) {
                        rightColHtml = `
                            <div class="leaderboard-prize-col rank-3">
                                <span class="prize-val">🥉 ₹25</span>
                                <span class="prize-label">3rd Prize</span>
                                <span class="referral-count">${count} Invites</span>
                            </div>
                        `;
                    } else if (rank <= 10) {
                        rightColHtml = `
                            <div class="leaderboard-prize-col rank-top10">
                                <span class="prize-val">🎁 ₹25</span>
                                <span class="prize-label">Prize</span>
                                <span class="referral-count">${count} Invites</span>
                            </div>
                        `;
                    } else {
                        rightColHtml = `
                            <div class="leaderboard-prize-col">
                                <span class="referral-count fw-bold text-light">${count} Invites</span>
                                <span class="prize-label text-secondary bg-dark border border-secondary">No Prize</span>
                            </div>
                        `;
                    }
                } else {
                    rightColHtml = `
                        <div class="leaderboard-earnings">₹${(shownEarnings || 0).toLocaleString('en-IN')}</div>
                    `;
                }

                const itemEl = document.createElement('div');
                itemEl.className = `leaderboard-item rank-${rank <= 3 ? rank : 'other'}`;
                itemEl.innerHTML = `
                    <div class="leaderboard-rank">#${rank}</div>
                    <img src="${photoURL}" alt="${displayName}" class="leaderboard-avatar">
                    <div class="leaderboard-user-info">
                        <div class="leaderboard-name">
                            <span>${displayName}</span>
                            ${user.isPremium ? '<span class="vip-pill-badge" title="VIP Elite Member"><i class="bi bi-crown-fill"></i> VIP</span>' : ''}
                        </div>
                        <div class="leaderboard-sub">${shownMatches} Matches | ${shownWon} Won</div>
                    </div>
                    ${rightColHtml}
                `;

                // Clicking any profile opens Player Profile modal with likes!
                itemEl.addEventListener('click', () => {
                    openLeaderboardUserProfile(user, rank);
                });

                listEl.appendChild(itemEl);
            });
        }, (error) => {
            console.error("Leaderboard error:", error);
            removePlaceholders(listEl);
            listEl.innerHTML = `<p class="text-center text-danger">Error loading leaderboard.</p>`;
        });

        dbListeners['leaderboardUsers'] = { path: 'users', func: unsub };

    } catch (error: any) {
        console.error("Leaderboard error:", error);
        removePlaceholders(listEl);
        listEl.innerHTML = `<p class="text-center text-danger">Error loading leaderboard.</p>`;
    }
}

function getLocalLikedProfiles(): Record<string, boolean> {
    if (!currentUser) return {};
    try {
        const stored = localStorage.getItem(`winbig_liked_profiles_${currentUser.uid}`);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

function isProfileLikedByUser(targetUid: string): boolean {
    if (!currentUser || !targetUid) return false;
    if (userProfile?.likedProfiles?.[targetUid]) return true;
    const local = getLocalLikedProfiles();
    return !!local[targetUid];
}

function setProfileLikedByUser(targetUid: string) {
    if (!currentUser || !targetUid) return;
    try {
        const local = getLocalLikedProfiles();
        local[targetUid] = true;
        localStorage.setItem(`winbig_liked_profiles_${currentUser.uid}`, JSON.stringify(local));
    } catch {}

    if (!userProfile.likedProfiles) userProfile.likedProfiles = {};
    userProfile.likedProfiles[targetUid] = true;

    // Save in user's own profile in Firebase (user has write permission on their own profile)
    try {
        update(ref(db, `users/${currentUser.uid}/likedProfiles`), {
            [targetUid]: true
        }).catch(() => {});
    } catch {}
}

// Web Audio Synthesizer Chime for Like feedback
function playLikeChime() {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.28, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch {
        // Optional audio feedback
    }
}

// Floating Particle Heart Burst Animation
function triggerHeartBurst() {
    const container = elements.lbHeartBurstContainer;
    if (!container) return;
    container.innerHTML = '';
    const particles = ['❤️', '💖', '✨', '🔥', '💕', '⭐', '💓', '💗'];
    for (let i = 0; i < 12; i++) {
        const p = document.createElement('span');
        p.className = 'burst-heart-particle';
        p.textContent = particles[Math.floor(Math.random() * particles.length)];
        const angle = (Math.PI * 2 * i) / 12 + (Math.random() * 0.3 - 0.15);
        const dist = 55 + Math.random() * 65;
        const tx = Math.cos(angle) * dist;
        const ty = -(45 + Math.random() * 65);
        p.style.setProperty('--tx', `${tx}px`);
        p.style.setProperty('--ty', `${ty}px`);
        p.style.left = '50%';
        p.style.top = '50%';
        container.appendChild(p);
        setTimeout(() => p.remove(), 1250);
    }
}

function openLeaderboardUserProfile(user: any, rank: number) {
    if (!elements.leaderboardUserProfileModalInstance) return;
    currentInspectedUser = user;

    // Detach previous profile likes live listener
    if (dbListeners['currentInspectedProfileLikes']) {
        try {
            off(ref(db, dbListeners['currentInspectedProfileLikes'].path));
        } catch {}
        delete dbListeners['currentInspectedProfileLikes'];
    }

    const displayName = user.displayName || user.email?.split('@')[0] || 'Player';
    const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0F172A&color=E2E8F0&bold=true&size=75`;
    const photoURL = resolveUserAvatarUrl(user, defaultAvatarUrl);

    elements.lbModalAvatar.src = photoURL;
    elements.lbModalName.textContent = displayName;
    if (currentLeaderboardTab === 'referrals') {
        let prizeNotice = '';
        if (rank === 1) prizeNotice = ' • 🏆 ₹100 Monthly Prize';
        else if (rank === 2) prizeNotice = ' • 🥈 ₹50 Monthly Prize';
        else if (rank === 3) prizeNotice = ' • 🥉 ₹25 Monthly Prize';
        else if (rank <= 10) prizeNotice = ' • 🎁 ₹25 Monthly Prize';
        elements.lbModalRank.textContent = `Top Referrals Rank #${rank}${prizeNotice}`;
    } else {
        elements.lbModalRank.textContent = `Top Players Rank #${rank}`;
    }
    const effectiveStats = getEffectiveUserStats(user.uid || '', user);
    const matches = effectiveStats.totalMatches;
    const won = effectiveStats.wonMatches;
    elements.lbModalMatches.textContent = String(matches);
    elements.lbModalWon.textContent = String(won);

    const winRate = matches > 0 ? Math.round((won / matches) * 100) : 0;
    elements.lbModalWinRate.textContent = `${winRate}%`;

    // Total Winnings
    const totalWinnings = effectiveStats.isTop180
        ? effectiveStats.totalEarnings
        : (effectiveStats.totalEarnings || user.winningCash || 0);
    if (elements.lbModalTotalWinning) {
        elements.lbModalTotalWinning.textContent = `₹${Number(totalWinnings).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Bio
    const userBio = user.bio && user.bio.trim() ? user.bio.trim() : "No bio added yet.";
    if (elements.lbModalBio) {
        elements.lbModalBio.textContent = `"${userBio}"`;
    }

    // Favourite Gun
    const favGun = user.favGun && user.favGun.trim() ? user.favGun.trim() : (user.favouriteGun && user.favouriteGun.trim() ? user.favouriteGun.trim() : "Not Set");
    if (elements.lbModalFavGun) {
        elements.lbModalFavGun.textContent = favGun;
    }

    // Instagram Redirect
    const instaUrl = getInstagramUrl(user.instagram);
    if (elements.lbModalInstagramBtn) {
        if (instaUrl) {
            elements.lbModalInstagramBtn.href = instaUrl;
            elements.lbModalInstagramBtn.classList.remove('opacity-50');
            elements.lbModalInstagramBtn.onclick = null;
        } else {
            elements.lbModalInstagramBtn.href = '#';
            elements.lbModalInstagramBtn.classList.add('opacity-50');
            elements.lbModalInstagramBtn.onclick = (e) => {
                e.preventDefault();
                alert(`${displayName} has not added an Instagram link.`);
            };
        }
    }

    // YouTube Redirect
    const ytUrl = getYoutubeUrl(user.youtube);
    if (elements.lbModalYoutubeBtn) {
        if (ytUrl) {
            elements.lbModalYoutubeBtn.href = ytUrl;
            elements.lbModalYoutubeBtn.classList.remove('opacity-50');
            elements.lbModalYoutubeBtn.onclick = null;
        } else {
            elements.lbModalYoutubeBtn.href = '#';
            elements.lbModalYoutubeBtn.classList.add('opacity-50');
            elements.lbModalYoutubeBtn.onclick = (e) => {
                e.preventDefault();
                alert(`${displayName} has not added a YouTube link.`);
            };
        }
    }

    // Ultra-Premium VIP Styling on Leaderboard Modal
    if (user.isPremium) {
        if (elements.lbModalContent) elements.lbModalContent.classList.add('vip-user-modal');
        if (elements.lbModalVipBanner) elements.lbModalVipBanner.style.display = 'block';
        if (elements.lbModalVipBadge) elements.lbModalVipBadge.style.display = 'flex';
        if (elements.lbModalAvatar) elements.lbModalAvatar.classList.add('vip-avatar-glow');
    } else {
        if (elements.lbModalContent) elements.lbModalContent.classList.remove('vip-user-modal');
        if (elements.lbModalVipBanner) elements.lbModalVipBanner.style.display = 'none';
        if (elements.lbModalVipBadge) elements.lbModalVipBadge.style.display = 'none';
        if (elements.lbModalAvatar) elements.lbModalAvatar.classList.remove('vip-avatar-glow');
    }

    const targetUid = user.uid || displayName;
    let hasLiked = false;
    if (currentUser) {
        hasLiked = isProfileLikedByUser(targetUid) || (user.likes && !!user.likes[currentUser.uid]);
        if (!user.likes) user.likes = {};
        if (hasLiked) {
            user.likes[currentUser.uid] = true;
        }
    }

    // Real likes count (NO MOCK LIKES: strictly 0 if no one has liked yet)
    const initialRealLikes = typeof user.likeCount === 'number' && user.likeCount > 0 ? user.likeCount : 0;
    updateLikeButtonUI(user, initialRealLikes, hasLiked);

    if (elements.lbModalLikeStatus) elements.lbModalLikeStatus.style.display = 'none';

    // Live Real-Time Likes Synchronization (count real unique user likes)
    try {
        const likesRef = ref(db, `profileLikes/${targetUid}`);
        const likesListener = onValue(likesRef, (snap) => {
            const data = snap.val();
            let count = 0;
            let userLiked = hasLiked;
            if (snap.exists() && data && typeof data === 'object') {
                count = Object.keys(data).length;
                if (currentUser && data[currentUser.uid]) {
                    userLiked = true;
                    setProfileLikedByUser(targetUid);
                }
            } else if (typeof user.likeCount === 'number' && user.likeCount > 0) {
                count = user.likeCount;
            } else {
                count = 0;
            }
            if (currentInspectedUser && (currentInspectedUser.uid === targetUid || currentInspectedUser.displayName === targetUid)) {
                currentInspectedUser.likeCount = count;
                updateLikeButtonUI(currentInspectedUser, count, userLiked);
            }
        });
        dbListeners['currentInspectedProfileLikes'] = { path: `profileLikes/${targetUid}`, func: likesListener };
    } catch (e) {
        console.warn("Could not attach live likes listener:", e);
    }

    // Clean up listener when modal closes
    if (elements.leaderboardUserProfileModalEl && !elements.leaderboardUserProfileModalEl.dataset.cleanupset) {
        elements.leaderboardUserProfileModalEl.dataset.cleanupset = 'true';
        elements.leaderboardUserProfileModalEl.addEventListener('hidden.bs.modal', () => {
            if (dbListeners['currentInspectedProfileLikes']) {
                try {
                    off(ref(db, dbListeners['currentInspectedProfileLikes'].path));
                } catch {}
                delete dbListeners['currentInspectedProfileLikes'];
            }
        });
    }

    updateProfileFriendActionButton(user);
    updateInspectedPlayerRankUI(user);
    elements.leaderboardUserProfileModalInstance.show();
}

function updateLikeButtonUI(user: any, currentLikes: number, hasLiked: boolean) {
    if (!elements.lbModalLikeCount || !elements.lbModalLikeBtn || !elements.lbModalLikeText) return;

    if (currentLikes >= 1000) {
        elements.lbModalLikeCount.textContent = (currentLikes / 1000).toFixed(1) + 'k';
    } else {
        elements.lbModalLikeCount.textContent = String(currentLikes || 0);
    }

    if (hasLiked) {
        elements.lbModalLikeBtn.className = 'premium-like-btn liked';
        elements.lbModalLikeText.textContent = 'Liked';
        if (elements.lbModalHeartIcon) {
            elements.lbModalHeartIcon.className = 'bi bi-heart-fill';
        }
        elements.lbModalLikeBtn.disabled = true;
    } else {
        elements.lbModalLikeBtn.className = 'premium-like-btn';
        elements.lbModalLikeText.textContent = 'Like Profile';
        if (elements.lbModalHeartIcon) {
            elements.lbModalHeartIcon.className = 'bi bi-heart-fill';
        }
        elements.lbModalLikeBtn.disabled = false;
    }
}

async function handleLikeProfileClick() {
    if (!currentUser) {
        showStatusMessage(elements.loginStatusMessage, "Please login first to like profiles!", "warning");
        showSection('login-section');
        return;
    }
    if (!currentInspectedUser) return;
    const targetUid = currentInspectedUser.uid || currentInspectedUser.displayName;

    if (targetUid === currentUser.uid) {
        if (elements.lbModalLikeStatus) {
            elements.lbModalLikeStatus.innerHTML = '<span class="text-warning fw-medium"><i class="bi bi-exclamation-circle-fill me-1"></i> You cannot like your own profile!</span>';
            elements.lbModalLikeStatus.style.display = 'block';
        }
        return;
    }

    // 1 ID se 1 baar hi like ho sake
    if (isProfileLikedByUser(targetUid) || (currentInspectedUser.likes && currentInspectedUser.likes[currentUser.uid])) {
        if (elements.lbModalLikeStatus) {
            elements.lbModalLikeStatus.innerHTML = '<span class="text-info fw-medium"><i class="bi bi-info-circle-fill me-1"></i> You have already liked this profile once!</span>';
            elements.lbModalLikeStatus.style.display = 'block';
        }
        return;
    }

    // Play Premium Like Animation (Heart Burst + Pop + Chime)
    triggerHeartBurst();
    elements.lbModalLikeBtn.classList.add('btn-popping');
    setTimeout(() => {
        elements.lbModalLikeBtn.classList.remove('btn-popping');
    }, 600);
    playLikeChime();

    // Persist like in user's profile and local cache (1 ID = 1 like permanently)
    setProfileLikedByUser(targetUid);
    if (!currentInspectedUser.likes) currentInspectedUser.likes = {};
    currentInspectedUser.likes[currentUser.uid] = true;

    // Real increment: 0 likes becomes 1 on first like
    const currentCount = typeof currentInspectedUser.likeCount === 'number' && currentInspectedUser.likeCount > 0 ? currentInspectedUser.likeCount : 0;
    const newCount = currentCount + 1;
    currentInspectedUser.likeCount = newCount;

    updateLikeButtonUI(currentInspectedUser, newCount, true);

    if (elements.lbModalLikeStatus) {
        elements.lbModalLikeStatus.innerHTML = '<span class="text-success fw-bold"><i class="bi bi-heart-fill text-danger me-1"></i> Profile Liked! Thank you for supporting!</span>';
        elements.lbModalLikeStatus.style.display = 'block';
    }

    // Write real like to Firebase Realtime Database
    try {
        const targetLikesRef = ref(db, `profileLikes/${targetUid}/${currentUser.uid}`);
        set(targetLikesRef, {
            likedBy: currentUser.uid,
            likerName: userProfile.displayName || currentUser.email || 'Player',
            timestamp: serverTimestamp()
        }).catch(() => {});

        runTransaction(ref(db, `users/${targetUid}/likeCount`), (cur) => {
            return (cur || 0) + 1;
        }).catch(() => {});
    } catch (e) {
        console.warn("Remote like write error:", e);
    }
}

/* =========================================================
   BUY PREMIUM & SUBSCRIPTION (299 COINS)
   ========================================================= */
let isPurchasingPremium = false;

function openBuyPremiumModal() {
    if (!currentUser) {
        showStatusMessage(elements.loginStatusMessage, "Please login first to view VIP Subscription.", "warning");
        showSection('login-section');
        return;
    }
    clearStatusMessage(elements.premiumStatusMessage);

    const balances = extractBalances(userProfile);
    const totalBalance = balances.total;
    const premiumCost = 299;

    if (elements.premiumModalUserBalance) {
        elements.premiumModalUserBalance.textContent = `₹${totalBalance.toFixed(2)}`;
    }
    if (elements.premiumModalInsufficientBadge) {
        elements.premiumModalInsufficientBadge.style.display = totalBalance < premiumCost ? 'inline-block' : 'none';
    }

    if (userProfile.isPremium) {
        elements.alreadySubscribedBanner.style.display = 'block';
        elements.vipActiveUidDisplay.textContent = userProfile.premiumFfUid || userProfile.gameUid || 'Saved';
        elements.vipRareBundleCodeDisplay.textContent = userProfile.rareBundleCode || 'RARE-ELITE-VIP-99';
        elements.confirmBuyPremiumBtn.style.display = 'none';
    } else {
        elements.alreadySubscribedBanner.style.display = 'none';
        elements.confirmBuyPremiumBtn.style.display = 'block';
        elements.confirmBuyPremiumBtn.disabled = false;
        elements.confirmBuyPremiumBtn.innerHTML = '<i class="bi bi-gem me-1"></i> Confirm & Buy (299 Coins)';
        elements.premiumFfUidInput.value = userProfile.gameUid || userProfile.premiumFfUid || '';
    }

    elements.premiumSubscriptionModalInstance?.show();
}

async function confirmBuyPremiumSubscription() {
    if (!currentUser) {
        showSection('login-section');
        return;
    }
    if (isPurchasingPremium) {
        return;
    }
    if (userProfile?.isPremium) {
        elements.alreadySubscribedBanner.style.display = 'block';
        elements.confirmBuyPremiumBtn.style.display = 'none';
        return;
    }

    const balances = extractBalances(userProfile);
    const totalBalance = balances.total;
    const premiumCost = 299;

    // CHECK WALLET BALANCE FIRST (Explicitly requested by user)
    if (totalBalance < premiumCost) {
        const shortage = (premiumCost - totalBalance).toFixed(2);
        const msgHtml = `
            <div class="alert alert-danger text-start p-3 mb-2 rounded-3 border-danger shadow-sm">
                <div class="fw-bold text-danger mb-1 fs-6">
                    <i class="bi bi-exclamation-octagon-fill me-1"></i> Not Enough Money! (Insufficient Balance)
                </div>
                <div class="small text-light mb-2">
                    Aapke wallet me sirf <strong>₹${totalBalance.toFixed(2)}</strong> hai. VIP Subscription lene ke liye <strong>299 Coins (₹299)</strong> chahiye (Shortage: ₹${shortage}).
                </div>
                <button type="button" class="btn btn-sm btn-warning w-100 fw-bold py-2 mt-1 shadow-sm" id="premiumAddCashQuickBtn">
                    <i class="bi bi-wallet2 me-1"></i> Add Cash to Wallet (₹${shortage} add karein)
                </button>
            </div>
        `;
        showStatusMessage(elements.premiumStatusMessage, msgHtml, "danger", false);
        elements.premiumStatusMessage?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        document.getElementById('premiumAddCashQuickBtn')?.addEventListener('click', () => {
            elements.premiumSubscriptionModalInstance?.hide();
            startRechargeFlow();
        });
        return;
    }

    const ffUid = elements.premiumFfUidInput.value.trim();
    if (!ffUid) {
        const msgHtml = `
            <div class="alert alert-warning text-start p-2 mb-2 rounded-3 border-warning">
                <div class="fw-bold text-warning mb-1">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i> Free Fire UID Zaroori Hai!
                </div>
                <div class="small text-light">
                    Rare Dress aur Diamond Giveaway draw me part lene ke liye kripya apna Free Fire UID enter karein.
                </div>
            </div>
        `;
        showStatusMessage(elements.premiumStatusMessage, msgHtml, "warning", false);
        elements.premiumFfUidInput?.focus();
        elements.premiumFfUidInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    isPurchasingPremium = true;
    elements.confirmBuyPremiumBtn.disabled = true;
    elements.confirmBuyPremiumBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Activating VIP...';
    clearStatusMessage(elements.premiumStatusMessage);

    try {
        const uRef = ref(db, `users/${currentUser.uid}`);
        await get(uRef);
        const rareBundleCode = `RARE-VIP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

        let insufficientBalanceError = false;
        let alreadyPremium = false;

        const txResult = await runTransaction(uRef, (profile) => {
            if (!profile) return profile;
            if (profile.isPremium) {
                alreadyPremium = true;
                return;
            }
            const pBalances = extractBalances(profile);
            const dep = pBalances.deposit;
            const win = pBalances.winning;
            const bon = pBalances.bonus;
            if (dep + win + bon < premiumCost) {
                insufficientBalanceError = true;
                return;
            }

            let remaining = premiumCost;
            const deductDeposit = Math.min(dep, remaining);
            remaining -= deductDeposit;

            const deductWinnings = Math.min(win, remaining);
            remaining -= deductWinnings;

            const deductBonus = Math.min(bon, remaining);
            remaining -= deductBonus;

            profile.depositBalance = Math.max(0, dep - deductDeposit);
            profile.winningCash = Math.max(0, win - deductWinnings);
            profile.bonusCash = Math.max(0, bon - deductBonus);
            profile.balance = profile.depositBalance + profile.winningCash + profile.bonusCash;
            profile.walletBalance = profile.balance;
            profile.isPremium = true;
            profile.premiumFfUid = ffUid;
            profile.rareBundleCode = rareBundleCode;
            profile.premiumPurchasedAt = serverTimestamp();
            return profile;
        });

        if (alreadyPremium) {
            userProfile.isPremium = true;
            populateUserInfo(currentUser, userProfile);
            elements.alreadySubscribedBanner.style.display = 'block';
            elements.confirmBuyPremiumBtn.style.display = 'none';
            return;
        }

        if (insufficientBalanceError || !txResult.committed) {
            throw new Error("Insufficient wallet balance.");
        }

        await recordTransaction(currentUser.uid, 'subscription_purchase', -premiumCost, `Bought VIP Premium & Subscription`, { rareBundleCode });

        if (txResult.snapshot.exists()) {
            userProfile = txResult.snapshot.val();
        } else {
            userProfile.isPremium = true;
            userProfile.premiumFfUid = ffUid;
            userProfile.rareBundleCode = rareBundleCode;
        }
        populateUserInfo(currentUser, userProfile);
        if (currentSectionId === 'wallet-section') loadRecentTransactions();

        showStatusMessage(
            elements.premiumStatusMessage,
            `🎉 <strong>Congratulations!</strong> VIP Premium Activated! Your Rare Bundle Gift Code is: <strong class="text-warning">${rareBundleCode}</strong>`,
            "success",
            false
        );

        elements.alreadySubscribedBanner.style.display = 'block';
        elements.vipActiveUidDisplay.textContent = ffUid;
        elements.vipRareBundleCodeDisplay.textContent = rareBundleCode;
        elements.confirmBuyPremiumBtn.style.display = 'none';

    } catch (e: any) {
        console.error("Premium purchase failed:", e);
        showStatusMessage(elements.premiumStatusMessage, `Purchase failed: ${e.message}`, "danger");
        elements.confirmBuyPremiumBtn.disabled = false;
        elements.confirmBuyPremiumBtn.innerHTML = '<i class="bi bi-gem me-1"></i> Confirm & Buy (299 Coins)';
    } finally {
        isPurchasingPremium = false;
    }
}

// =================== REDEEM GIFT CARDS SYSTEM ===================
let selectedRedeemBrand: 'google_play' | 'amazon' = 'google_play';
let userRedemptionsList: any[] = [];
let redemptionsListenerInitialized = false;

function openRedeemGiftCardModal() {
    if (!currentUser || !elements.redeemGiftCardModalInstance) return;
    
    // Update user balance in modal
    const pBalances = extractBalances(userProfile);
    const totalBal = pBalances.deposit + pBalances.winning;
    if (elements.redeemModalWalletBalance) {
        elements.redeemModalWalletBalance.textContent = `₹${totalBal.toFixed(2)}`;
    }
    if (elements.redeemBalanceStatusBadge) {
        if (totalBal >= 30) {
            elements.redeemBalanceStatusBadge.className = 'badge bg-success rounded-pill px-2 py-1';
            elements.redeemBalanceStatusBadge.textContent = 'Eligible (≥ ₹30)';
        } else {
            elements.redeemBalanceStatusBadge.className = 'badge bg-danger rounded-pill px-2 py-1';
            elements.redeemBalanceStatusBadge.textContent = 'Low Balance (< ₹30)';
        }
    }

    clearStatusMessage(elements.redeemStatusMessage);
    switchRedeemTab('buy');
    updateSubmitRedeemBtnText();
    setupRedemptionsRealtimeListener();
    loadUserRedemptions();
    elements.redeemGiftCardModalInstance.show();
}

function switchRedeemTab(tab: 'buy' | 'history') {
    if (tab === 'buy') {
        if (elements.redeemBuyView) elements.redeemBuyView.style.display = 'block';
        if (elements.redeemHistoryView) elements.redeemHistoryView.style.display = 'none';
        if (elements.redeemTabBuyBtn) {
            elements.redeemTabBuyBtn.style.background = 'var(--accent-gradient)';
            elements.redeemTabBuyBtn.className = 'btn btn-sm flex-fill rounded-3 fw-bold text-dark py-2';
        }
        if (elements.redeemTabHistoryBtn) {
            elements.redeemTabHistoryBtn.style.background = 'transparent';
            elements.redeemTabHistoryBtn.className = 'btn btn-sm flex-fill rounded-3 fw-bold text-secondary py-2';
        }
    } else {
        if (elements.redeemBuyView) elements.redeemBuyView.style.display = 'none';
        if (elements.redeemHistoryView) elements.redeemHistoryView.style.display = 'block';
        if (elements.redeemTabHistoryBtn) {
            elements.redeemTabHistoryBtn.style.background = 'var(--accent-gradient)';
            elements.redeemTabHistoryBtn.className = 'btn btn-sm flex-fill rounded-3 fw-bold text-dark py-2';
        }
        if (elements.redeemTabBuyBtn) {
            elements.redeemTabBuyBtn.style.background = 'transparent';
            elements.redeemTabBuyBtn.className = 'btn btn-sm flex-fill rounded-3 fw-bold text-secondary py-2';
        }
        loadUserRedemptions();
    }
}

function selectRedeemBrand(brand: 'google_play' | 'amazon') {
    selectedRedeemBrand = brand;
    if (brand === 'google_play') {
        elements.brandCardGooglePlay?.classList.add('selected');
        const gpBadge = elements.brandCardGooglePlay?.querySelector('.brand-check-badge') as HTMLElement;
        if (gpBadge) gpBadge.style.display = 'block';

        elements.brandCardAmazon?.classList.remove('selected');
        const amazonBadge = elements.brandCardAmazon?.querySelector('.brand-check-badge') as HTMLElement;
        if (amazonBadge) amazonBadge.style.display = 'none';
    } else {
        elements.brandCardAmazon?.classList.add('selected');
        const amazonBadge = elements.brandCardAmazon?.querySelector('.brand-check-badge') as HTMLElement;
        if (amazonBadge) amazonBadge.style.display = 'block';

        elements.brandCardGooglePlay?.classList.remove('selected');
        const gpBadge = elements.brandCardGooglePlay?.querySelector('.brand-check-badge') as HTMLElement;
        if (gpBadge) gpBadge.style.display = 'none';
    }
    updateSubmitRedeemBtnText();
}

function updateSubmitRedeemBtnText() {
    if (!elements.submitRedeemBtn) return;
    const amountVal = parseFloat(elements.redeemCustomAmountInput?.value || '0');
    const brandName = selectedRedeemBrand === 'google_play' ? 'Google Play' : 'Amazon Pay';
    if (!isNaN(amountVal) && amountVal > 0) {
        elements.submitRedeemBtn.innerHTML = `<i class="bi bi-lightning-charge-fill me-1"></i> Redeem ${brandName} (₹${amountVal})`;
    } else {
        elements.submitRedeemBtn.innerHTML = `<i class="bi bi-lightning-charge-fill me-1"></i> Redeem ${brandName}`;
    }
}

let isRedeemingGiftCard = false;

async function handleConfirmRedeem() {
    if (!currentUser) {
        alert("Please login first to redeem gift cards.");
        return;
    }
    if (isRedeemingGiftCard) return;

    const amount = parseFloat(elements.redeemCustomAmountInput?.value || '0');
    if (isNaN(amount) || amount < 30) {
        showStatusMessage(elements.redeemStatusMessage, `Minimum redeem code amount 30 rs se upar hona chahiye (e.g. ₹50, ₹100, ₹500).`, "danger");
        elements.redeemCustomAmountInput?.focus();
        return;
    }

    const pBalances = extractBalances(userProfile);
    const totalAvailable = pBalances.deposit + pBalances.winning;
    if (totalAvailable < amount) {
        showStatusMessage(elements.redeemStatusMessage, `Aapke wallet me paryapt balance nahi hai. Available: ₹${totalAvailable.toFixed(2)}, Required: ₹${amount}.`, "danger");
        return;
    }

    const brandName = selectedRedeemBrand === 'google_play' ? 'Google Play Gift Card' : 'Amazon Pay Gift Card';

    isRedeemingGiftCard = true;
    elements.submitRedeemBtn.disabled = true;
    elements.submitRedeemBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Processing Order...';
    clearStatusMessage(elements.redeemStatusMessage);

    try {
        const uRef = ref(db, `users/${currentUser.uid}`);
        await get(uRef);
        let insufficientRedeemErr = false;

        const txResult = await runTransaction(uRef, (profile) => {
            if (!profile) return profile;
            const pb = extractBalances(profile);
            const total = pb.deposit + pb.winning;
            if (total < amount) {
                insufficientRedeemErr = true;
                return;
            }

            let deductedDeposit = 0;
            let deductedWinning = 0;

            // Deduct from winning first, then deposit
            if (pb.winning >= amount) {
                deductedWinning = amount;
            } else {
                deductedWinning = pb.winning;
                deductedDeposit = amount - pb.winning;
            }

            const newWinning = Math.max(0, pb.winning - deductedWinning);
            const newDeposit = Math.max(0, pb.deposit - deductedDeposit);
            const newTotal = newWinning + newDeposit + (pb.bonus || 0);

            profile.winningCash = newWinning;
            profile.winningBalance = newWinning;
            profile.depositBalance = newDeposit;
            profile.balance = newTotal;
            profile.walletBalance = newTotal;
            return profile;
        });

        if (insufficientRedeemErr || !txResult.committed) {
            throw new Error(`Insufficient balance for ₹${amount} redemption.`);
        }

        if (txResult.snapshot.exists()) {
            userProfile = txResult.snapshot.val();
        }
        populateUserInfo(currentUser, userProfile);

        const userRedeemListRef = ref(db, `users/${currentUser.uid}/redemptions`);
        const redemptionRef = push(userRedeemListRef);
        const redemptionId = redemptionRef.key || `GC_${Date.now()}`;
        const wRef = push(ref(db, 'withdrawals'));
        const withdrawalId = wRef.key || redemptionId;

        const redemptionData = {
            id: redemptionId,
            withdrawalId: withdrawalId,
            userId: currentUser.uid,
            userName: userProfile.displayName || currentUser.email?.split('@')[0] || "Player",
            userEmail: currentUser.email || "",
            brand: selectedRedeemBrand,
            brandName: brandName,
            amount: amount,
            status: "pending",
            code: "",
            createdAt: Date.now(),
            timestamp: serverTimestamp(),
            estimatedDelivery: "Within 1 Hour"
        };

        // Save under user's own profile node (guaranteed read/write permission)
        await set(ref(db, `users/${currentUser.uid}/redemptions/${redemptionId}`), redemptionData);

        const withdrawalPayload = {
            id: withdrawalId,
            userId: currentUser.uid,
            userName: redemptionData.userName,
            userEmail: redemptionData.userEmail,
            amount: amount,
            methodDetails: { methodName: brandName, accountInfo: `Gift Card (${brandName} - ₹${amount})` },
            status: 'pending',
            isGiftCard: true,
            brand: selectedRedeemBrand,
            redemptionId: redemptionId,
            createdAt: redemptionData.createdAt,
            requestTimestamp: serverTimestamp()
        };

        // Also mirror to withdrawals, user withdrawals, and optional top-level redemptions nodes for admin panel visibility
        set(wRef, withdrawalPayload).catch(() => {});
        set(ref(db, `users/${currentUser.uid}/withdrawals/${withdrawalId}`), withdrawalPayload).catch(() => {});
        set(ref(db, `redemptions/${redemptionId}`), redemptionData).catch(() => {});
        set(ref(db, `userRedemptions/${currentUser.uid}/${redemptionId}`), redemptionData).catch(() => {});

        // Record transaction
        await recordTransaction(
            currentUser.uid,
            'redeem_gift_card',
            -amount,
            `${brandName} (₹${amount})`,
            { redemptionId, withdrawalId, brand: selectedRedeemBrand, amount }
        );

        if (currentSectionId === 'wallet-section') loadRecentTransactions();

        showStatusMessage(elements.redeemStatusMessage, `🎉 Redeem request successful! ₹${amount} deducted from wallet. Please wait for 1 hours.`, "success");
        
        // Refresh balance in modal
        const updatedBal = extractBalances(userProfile);
        if (elements.redeemModalWalletBalance) elements.redeemModalWalletBalance.textContent = `₹${(updatedBal.deposit + updatedBal.winning).toFixed(2)}`;

        // Switch to history tab automatically after 1 second
        setTimeout(() => {
            switchRedeemTab('history');
        }, 1200);

    } catch (e: any) {
        console.error("Redeem failed:", e);
        showStatusMessage(elements.redeemStatusMessage, `Redeem failed: ${e.message}`, "danger");
    } finally {
        isRedeemingGiftCard = false;
        elements.submitRedeemBtn.disabled = false;
        updateSubmitRedeemBtnText();
    }
}

function decodeFirebasePushKeyTimestamp(key: string): number {
    if (!key || typeof key !== 'string' || key.length < 8 || !key.startsWith('-')) return 0;
    const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
    let time = 0;
    for (let i = 0; i < 8; i++) {
        const c = PUSH_CHARS.indexOf(key.charAt(i));
        if (c === -1) return 0;
        time = time * 64 + c;
    }
    return time;
}

function getRecordTimestamp(record: any, key?: string): number {
    if (!record || typeof record !== 'object') return key ? decodeFirebasePushKeyTimestamp(key) : 0;
    const raw =
        record.updatedAt ??
        record.approvedAt ??
        record.completedAt ??
        record.processedAt ??
        record.timestamp ??
        record.createdAt ??
        record.requestTimestamp ??
        record.date ??
        record.time;
    if (typeof raw === 'number' && raw > 0) return raw;
    if (typeof raw === 'string' && raw.trim()) {
        const num = Number(raw);
        if (!isNaN(num) && num > 0) return num;
        const parsed = Date.parse(raw);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return key ? decodeFirebasePushKeyTimestamp(key) : 0;
}

function cleanAdminNoteText(rawText: string): string {
    if (!rawText) return '';
    let cleaned = String(rawText).trim();
    if (!cleaned) return '';

    const lowerDesc = cleaned.toLowerCase();
    if (
        lowerDesc === 'welcome bonus' ||
        lowerDesc === 'bought vip premium & subscription' ||
        lowerDesc.startsWith('google play gift card (') ||
        lowerDesc.startsWith('amazon pay gift card (') ||
        lowerDesc.startsWith('amazon gift card (') ||
        lowerDesc.startsWith('gift card (') ||
        lowerDesc.startsWith('withdrawal request to ') ||
        lowerDesc.startsWith('joined:') ||
        lowerDesc.startsWith('joined :') ||
        lowerDesc.startsWith('referral bonus:') ||
        /^withdrawal\s+of\s+.*?\s+approved\.?\s*$/i.test(cleaned)
    ) {
        return '';
    }

    // Extract note if prefixed with "Ref:", "Note:", "Admin Note:", "Redeem Code:", etc.
    const labeledMatch = cleaned.match(/\b(?:admin\s*note|note|redeem\s*code|gift\s*code|voucher\s*code|code|remarks?|ref|reference)\s*[:\-–=]\s*([^\)]+)\)?$/i);
    if (labeledMatch && labeledMatch[1] && labeledMatch[1].trim()) {
        cleaned = labeledMatch[1].trim();
    } else {
        const actionPrefixMatch = cleaned.match(/^(?:withdrawal\s*(?:of\s+[^\s]+\s+)?(?:request\s*)?(?:approved|completed|successful|success|processed)\.?|deposit\s*(?:request\s*)?approved|admin\s*(?:credit|debit|update|bonus|adjustment|action)|manual\s*(?:credit|debit|update)|approved|completed|processed)\s*(?:[:\-–|]\s*(.+)|\((.+)\))$/i);
        if (actionPrefixMatch) {
            cleaned = (actionPrefixMatch[1] || actionPrefixMatch[2] || '').trim();
        }
    }

    const genericPhrases = new Set([
        'deposit', 'deposit approved', 'deposit request', 'deposit rejected',
        'recharge', 'recharge approved', 'withdrawal', 'withdrawal approved',
        'withdrawal request', 'withdrawal rejected', 'withdrawal pending',
        'approved', 'approved by admin', 'pending', 'rejected', 'completed', 'processing',
        'success', 'successful', 'txn', 'transaction', 'admin', 'admin credit',
        'admin debit', 'admin update', 'manual', 'manual credit', 'manual debit',
        'credit', 'debit', 'wallet update', 'balance update', 'balance updated'
    ]);

    if (!cleaned || genericPhrases.has(cleaned.toLowerCase())) {
        return '';
    }

    return cleaned;
}

function extractCleanAdminNote(record: any, isWithdrawalRecord = false): string {
    if (!record || typeof record !== 'object') return '';

    // 1. Check explicit note / code fields first
    const explicitCandidates = [
        record.code,
        record.redeemCode,
        record.redeem_code,
        record.giftCode,
        record.gift_code,
        record.voucherCode,
        record.note,
        record.adminNote,
        record.admin_note,
        record.notes,
        record.remarks,
        record.remark,
        record.comment,
        record.reason,
        record.details?.code,
        record.details?.redeemCode,
        record.details?.note,
        record.details?.adminNote,
        record.details?.remarks,
        record.methodDetails?.note,
        record.methodDetails?.code,
        record.methodDetails?.redeemCode
    ];

    for (const cand of explicitCandidates) {
        if (cand !== undefined && cand !== null && String(cand).trim().length > 0) {
            const cleanedCand = cleanAdminNoteText(String(cand));
            if (cleanedCand) return cleanedCand;
        }
    }

    const type = String(record.type || '').toLowerCase().trim();
    const internalTypes = ['signup_bonus', 'subscription_purchase', 'tournament_join', 'referral_bonus', 'withdraw_request', 'withdrawal_request', 'redeem_gift_card'];
    if (!isWithdrawalRecord && internalTypes.includes(type)) {
        return '';
    }

    const rawDesc = String(record.description ?? record.message ?? record.text ?? record.title ?? '').trim();
    if (!rawDesc) return '';

    return cleanAdminNoteText(rawDesc);
}

let isSyncingRedemptionNotes = false;
async function syncRedemptionsWithAdminNotes(uid: string) {
    if (!uid || !db || isSyncingRedemptionNotes) return;
    isSyncingRedemptionNotes = true;
    try {
        const redemptionsRef = ref(db, `users/${uid}/redemptions`);
        const redSnap = await get(redemptionsRef).catch(() => null);
        const redMap: Record<string, any> = (redSnap && redSnap.exists() ? redSnap.val() : (userProfile?.redemptions || {})) || {};
        const redKeys = Object.keys(redMap);
        if (redKeys.length === 0) {
            isSyncingRedemptionNotes = false;
            return;
        }

        const [txSnap, wSnap] = await Promise.all([
            get(ref(db, `transactions/${uid}`)).catch(() => null),
            get(ref(db, 'withdrawals')).catch(() => null)
        ]);

        // Identify all withdrawalIds that belong to Gift Card Redemptions vs normal Cash Withdrawals
        const giftCardWithdrawalIds = new Set<string>();
        const cashWithdrawalIds = new Set<string>();

        for (const [rKey, rVal] of Object.entries(redMap)) {
            if (rVal && typeof rVal === 'object') {
                if (rVal.withdrawalId) giftCardWithdrawalIds.add(String(rVal.withdrawalId));
                giftCardWithdrawalIds.add(rKey);
            }
        }

        if (txSnap && txSnap.exists()) {
            txSnap.forEach((child) => {
                const tx = child.val();
                if (!tx || typeof tx !== 'object') return;
                const txType = String(tx.type || '').toLowerCase();
                if (txType === 'redeem_gift_card') {
                    if (tx.withdrawalId) giftCardWithdrawalIds.add(String(tx.withdrawalId));
                    if (tx.redemptionId) giftCardWithdrawalIds.add(String(tx.redemptionId));
                } else if (txType === 'withdraw_request' || txType === 'withdrawal_request') {
                    if (tx.withdrawalId) cashWithdrawalIds.add(String(tx.withdrawalId));
                }
            });
        }

        // Map user's top-level withdrawals by withdrawalId and by redemptionId for 1-to-1 matching
        const userWithdrawalsById = new Map<string, any>();
        const userWithdrawalsByRedemptionId = new Map<string, { wKey: string; w: any }>();

        if (wSnap && wSnap.exists()) {
            wSnap.forEach((child) => {
                const w = child.val();
                const key = child.key || '';
                if (!w || !key || w.userId !== uid) return;
                userWithdrawalsById.set(key, w);
                if (w.redemptionId) {
                    userWithdrawalsByRedemptionId.set(String(w.redemptionId), { wKey: key, w });
                }
                if (w.isGiftCard || w.redemptionId) {
                    giftCardWithdrawalIds.add(key);
                } else {
                    cashWithdrawalIds.add(key);
                }
            });
        }

        interface CandidateNote {
            id: string;
            note: string;
            timestamp: number;
            redemptionId?: string;
            withdrawalId?: string;
            txKey?: string;
        }

        const candidateNotes: CandidateNote[] = [];
        const seenNoteIds = new Set<string>();

        const addCandidate = (id: string, note: string, timestamp: number, redemptionId?: string, withdrawalId?: string, txKey?: string) => {
            const clean = (note || '').trim();
            if (!id || !clean || seenNoteIds.has(id)) return;
            // Never allow a normal cash withdrawal note to be added as a gift card redeem code candidate
            if (withdrawalId && cashWithdrawalIds.has(withdrawalId) && !giftCardWithdrawalIds.has(withdrawalId)) {
                return;
            }
            seenNoteIds.add(id);
            candidateNotes.push({ id, note: clean, timestamp, redemptionId, withdrawalId, txKey });
        };

        // 1. Check top-level withdrawals (authoritative source for gift card redemptions)
        for (const [key, w] of userWithdrawalsById.entries()) {
            if (!w.isGiftCard && !w.redemptionId && !giftCardWithdrawalIds.has(key)) {
                continue;
            }
            const note = extractCleanAdminNote(w, true);
            if (note) {
                const ts = getRecordTimestamp(w, key);
                addCandidate(`w_${key}`, note, ts, w.redemptionId, key);
            }
        }

        // 2. Check users/${uid}/withdrawals
        const userWithdrawals = userProfile?.withdrawals || {};
        for (const [key, w] of Object.entries(userWithdrawals)) {
            if (!w || typeof w !== 'object') continue;
            if (cashWithdrawalIds.has(key) && !giftCardWithdrawalIds.has(key) && !(w as any).isGiftCard && !(w as any).redemptionId) {
                continue;
            }
            const note = extractCleanAdminNote(w, true);
            if (note) {
                const ts = getRecordTimestamp(w, key);
                addCandidate(`uw_${key}`, note, ts, (w as any).redemptionId, key);
            }
        }

        // 3. Check transactions/${uid} (only if explicitly linked to a gift card redemptionId or withdrawalId)
        if (txSnap && txSnap.exists()) {
            txSnap.forEach((child) => {
                const tx = child.val();
                const key = child.key || '';
                if (!tx || !key) return;
                if (!tx.redemptionId && (!tx.withdrawalId || !giftCardWithdrawalIds.has(String(tx.withdrawalId)))) {
                    return;
                }
                const note = extractCleanAdminNote(tx, false);
                if (note) {
                    const ts = getRecordTimestamp(tx, key);
                    addCandidate(`tx_${key}`, note, ts, tx.redemptionId, tx.withdrawalId, key);
                }
            });
        }

        candidateNotes.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        // Sort redemptions chronologically (oldest first) for matching
        const redemptionsChronological = Object.entries(redMap)
            .map(([k, v]: [string, any]) => ({ ...v, id: v.id || k, _key: k }))
            .sort((a, b) => (getRecordTimestamp(a, a._key) || 0) - (getRecordTimestamp(b, b._key) || 0));

        const usedNoteIds = new Set<string>();
        const updates: Record<string, any> = {};
        let anyUpdated = false;

        for (const item of redemptionsChronological) {
            const rKey = item._key || item.id;

            // Check direct 1-to-1 match in top-level withdrawals first
            const directWMatch = userWithdrawalsByRedemptionId.get(rKey)
                || (item.withdrawalId && userWithdrawalsById.has(String(item.withdrawalId))
                    ? { wKey: String(item.withdrawalId), w: userWithdrawalsById.get(String(item.withdrawalId)) }
                    : null);

            if (directWMatch && directWMatch.w) {
                const wRecord = directWMatch.w;
                const wKey = directWMatch.wKey;
                const wStatus = String(wRecord.status || '').toLowerCase();
                const wNote = extractCleanAdminNote(wRecord, true);

                if ((wStatus === 'completed' || wStatus === 'approved' || wStatus === 'successful') && wNote) {
                    const noteId = `w_${wKey}`;
                    usedNoteIds.add(noteId);
                    if (item.code !== wNote || item.note !== wNote || item.status !== 'completed' || item.withdrawalId !== wKey) {
                        item.code = wNote;
                        item.note = wNote;
                        item.status = 'completed';
                        item.usedNoteId = noteId;
                        item.withdrawalId = wKey;
                        item.completedAt = getRecordTimestamp(wRecord, wKey) || Date.now();

                        updates[`users/${uid}/redemptions/${rKey}/code`] = wNote;
                        updates[`users/${uid}/redemptions/${rKey}/note`] = wNote;
                        updates[`users/${uid}/redemptions/${rKey}/status`] = 'completed';
                        updates[`users/${uid}/redemptions/${rKey}/usedNoteId`] = noteId;
                        updates[`users/${uid}/redemptions/${rKey}/withdrawalId`] = wKey;
                        updates[`users/${uid}/redemptions/${rKey}/completedAt`] = item.completedAt;
                        anyUpdated = true;
                    }
                    continue;
                } else if (wStatus === 'pending') {
                    // Explicitly pending in withdrawals -> ensure it stays pending and is never polluted by other notes
                    if (item.code || item.note || item.status !== 'pending') {
                        item.code = '';
                        item.note = '';
                        item.status = 'pending';
                        delete item.usedNoteId;
                        updates[`users/${uid}/redemptions/${rKey}/code`] = '';
                        updates[`users/${uid}/redemptions/${rKey}/note`] = '';
                        updates[`users/${uid}/redemptions/${rKey}/status`] = 'pending';
                        updates[`users/${uid}/redemptions/${rKey}/usedNoteId`] = null;
                        anyUpdated = true;
                    }
                    continue;
                }
            }

            // Look for an exact match by redemptionId or withdrawalId in candidateNotes
            const matched = candidateNotes.find(c =>
                !usedNoteIds.has(c.id) &&
                ((c.redemptionId && c.redemptionId === rKey) || (c.withdrawalId && item.withdrawalId && c.withdrawalId === item.withdrawalId))
            );

            if (matched) {
                usedNoteIds.add(matched.id);
                if (item.code !== matched.note || item.note !== matched.note || item.status !== 'completed' || item.usedNoteId !== matched.id) {
                    item.code = matched.note;
                    item.note = matched.note;
                    item.status = 'completed';
                    item.usedNoteId = matched.id;
                    item.completedAt = matched.timestamp || Date.now();

                    updates[`users/${uid}/redemptions/${rKey}/code`] = matched.note;
                    updates[`users/${uid}/redemptions/${rKey}/note`] = matched.note;
                    updates[`users/${uid}/redemptions/${rKey}/status`] = 'completed';
                    updates[`users/${uid}/redemptions/${rKey}/usedNoteId`] = matched.id;
                    updates[`users/${uid}/redemptions/${rKey}/completedAt`] = item.completedAt;
                    anyUpdated = true;
                }
                continue;
            }

            // 3. No matching admin approval note found yet for this redemption:
            // Check if item already has a valid direct code or if it was previously polluted by a cash withdrawal message
            const rawExisting = String(item.code || item.note || item.adminNote || item.redeemCode || item.giftCode || '').trim();
            const cleanedExisting = cleanAdminNoteText(rawExisting);
            const looksLikeCashWithdrawalMsg = /withdrawal|credited|wining|winning/i.test(rawExisting);

            if (rawExisting && (looksLikeCashWithdrawalMsg || !cleanedExisting)) {
                // Reset polluted pending redemption back to pending
                item.code = '';
                item.note = '';
                item.status = 'pending';
                delete item.usedNoteId;
                updates[`users/${uid}/redemptions/${rKey}/code`] = '';
                updates[`users/${uid}/redemptions/${rKey}/note`] = '';
                updates[`users/${uid}/redemptions/${rKey}/status`] = 'pending';
                updates[`users/${uid}/redemptions/${rKey}/usedNoteId`] = null;
                anyUpdated = true;
            } else if (cleanedExisting && (item.code !== cleanedExisting || item.status !== 'completed')) {
                item.code = cleanedExisting;
                item.note = cleanedExisting;
                item.status = 'completed';
                updates[`users/${uid}/redemptions/${rKey}/code`] = cleanedExisting;
                updates[`users/${uid}/redemptions/${rKey}/note`] = cleanedExisting;
                updates[`users/${uid}/redemptions/${rKey}/status`] = 'completed';
                anyUpdated = true;
            }
        }

        if (anyUpdated) {
            await update(ref(db), updates).catch(() => {});
        }

        userRedemptionsList = redemptionsChronological
            .map(r => {
                const copy = { ...r };
                delete copy._key;
                return copy;
            })
            .sort((a: any, b: any) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0));

        if (!userProfile.redemptions) userProfile.redemptions = {};
        userRedemptionsList.forEach(r => {
            if (r.id) userProfile.redemptions[r.id] = r;
        });

        renderRedemptionHistoryCards(userRedemptionsList);
    } catch (err) {
        console.warn("Redemption note sync error:", err);
    } finally {
        isSyncingRedemptionNotes = false;
    }
}

function setupRedemptionsRealtimeListener() {
    if (!currentUser || !db || redemptionsListenerInitialized) return;
    redemptionsListenerInitialized = true;
    const userRedemptionsRef = ref(db, `users/${currentUser.uid}/redemptions`);
    const unsub = onValue(userRedemptionsRef, (snap) => {
        if (!currentUser) return;
        const data = snap.val() || {};
        userRedemptionsList = Object.values(data).sort((a: any, b: any) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0));
        renderRedemptionHistoryCards(userRedemptionsList);
        syncRedemptionsWithAdminNotes(currentUser.uid);
    }, () => {
        // Ignore permission errors on listener
    });
    dbListeners['userRedemptions'] = { path: `users/${currentUser.uid}/redemptions`, func: unsub };
}

async function loadUserRedemptions() {
    if (!currentUser) return;
    if (elements.redeemHistoryCardsContainer && userRedemptionsList.length === 0) {
        elements.redeemHistoryCardsContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-warning me-2"></div><span class="text-secondary small">Loading your orders...</span></div>';
    }
    try {
        await syncRedemptionsWithAdminNotes(currentUser.uid);
        const snap = await get(ref(db, `users/${currentUser.uid}/redemptions`));
        const data = snap.val() || userProfile?.redemptions || {};
        userRedemptionsList = Object.values(data).sort((a: any, b: any) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0));
        renderRedemptionHistoryCards(userRedemptionsList);
    } catch {
        const fallbackData = userProfile?.redemptions || {};
        userRedemptionsList = Object.values(fallbackData).sort((a: any, b: any) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0));
        renderRedemptionHistoryCards(userRedemptionsList);
    }
}

function renderRedemptionHistoryCards(items: any[]) {
    if (!elements.redeemHistoryCardsContainer || !elements.redeemHistoryEmptyMsg) return;

    if (elements.redeemHistoryCountBadge) {
        elements.redeemHistoryCountBadge.textContent = items.length.toString();
        elements.redeemHistoryCountBadge.style.display = items.length > 0 ? 'inline-block' : 'none';
    }

    if (!items || items.length === 0) {
        elements.redeemHistoryCardsContainer.innerHTML = '';
        elements.redeemHistoryEmptyMsg.style.display = 'block';
        return;
    }

    elements.redeemHistoryEmptyMsg.style.display = 'none';
    elements.redeemHistoryCardsContainer.innerHTML = items.map(item => {
        const isGoogle = item.brand === 'google_play';
        const brandIcon = isGoogle ? '<i class="bi bi-google-play text-white"></i>' : '<i class="bi bi-bag-check-fill text-white"></i>';
        const brandBoxClass = isGoogle ? 'google-play-box' : 'amazon-box';
        const dateStr = item.createdAt ? formatFullDateTime(item.createdAt) : 'Recent Order';
        const codeValue = String(item.code || item.note || item.adminNote || item.redeemCode || '').trim();
        const hasCode = codeValue.length > 0;
        const isCompleted = item.status === 'completed' || item.status === 'approved' || item.status === 'successful' || item.status === 'success' || hasCode;

        let statusBlock = '';
        if (isCompleted && hasCode) {
            statusBlock = `
                <div class="p-3 rounded-3 mt-3 border border-success" style="background: rgba(16, 185, 129, 0.12);">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                        <span class="text-success fw-bold small"><i class="bi bi-shield-check me-1"></i> Redeem Code:</span>
                        <span class="badge bg-success text-white"><i class="bi bi-check-circle-fill me-1"></i>Successful</span>
                    </div>
                    <div class="d-flex align-items-center justify-content-between gap-2 p-2 rounded-2 bg-dark border border-secondary">
                        <span class="font-monospace text-warning fw-bold fs-6 referral-code text-break select-all" id="code_${item.id}">${escapeHtml(codeValue)}</span>
                        <button type="button" class="btn btn-sm btn-custom-accent copy-redeem-code-btn flex-shrink-0" data-code="${escapeHtml(codeValue)}">
                            <i class="bi bi-clipboard-check me-1"></i> Copy Code
                        </button>
                    </div>
                    <small class="text-secondary mt-2 d-block" style="font-size: 0.72rem;">
                        <i class="bi bi-info-circle me-1"></i> ${isGoogle ? 'Play Store > Profile > Payments & subscriptions > Redeem code' : 'Amazon App > Amazon Pay > Add Gift Card to balance'}
                    </small>
                </div>
            `;
        } else {
            statusBlock = `
                <div class="p-3 rounded-3 mt-3 border border-warning" style="background: rgba(245, 158, 11, 0.12);">
                    <div class="d-flex align-items-center justify-content-between gap-2">
                        <div class="d-flex align-items-center gap-2">
                            <span class="spinner-grow spinner-grow-sm text-warning" role="status"></span>
                            <strong class="text-warning small"><i class="bi bi-hourglass-split me-1"></i> Please wait for 1 hours</strong>
                        </div>
                        <span class="small text-warning fw-bold">Processing...</span>
                    </div>
                </div>
            `;
        }

        return `
            <div class="redeem-history-card">
                <div class="d-flex align-items-center justify-content-between mb-2">
                    <div class="d-flex align-items-center gap-2">
                        <div class="brand-icon-box ${brandBoxClass}" style="width: 36px; height: 36px;">
                            ${brandIcon}
                        </div>
                        <div>
                            <strong class="text-light d-block" style="font-size: 0.9rem;">${item.brandName || (isGoogle ? 'Google Play Gift Card' : 'Amazon Gift Card')}</strong>
                            <span class="text-secondary" style="font-size: 0.72rem;">${dateStr}</span>
                        </div>
                    </div>
                    <div class="text-end">
                        <span class="fs-5 fw-bold text-warning d-block">₹${item.amount}</span>
                        ${(isCompleted && hasCode) ? '<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Successful</span>' : '<span class="badge bg-warning text-dark">Processing</span>'}
                    </div>
                </div>
                ${statusBlock}
            </div>
        `;
    }).join('');

    // Attach copy button click listeners with fallback for mobile/iframe clipboard
    elements.redeemHistoryCardsContainer.querySelectorAll('.copy-redeem-code-btn').forEach(btn => {
        btn.addEventListener('click', (e: any) => {
            const targetBtn = e.currentTarget as HTMLButtonElement;
            const code = targetBtn.dataset.code;
            if (code) {
                const showCopiedFeedback = () => {
                    const originalHtml = '<i class="bi bi-clipboard-check me-1"></i> Copy Code';
                    targetBtn.innerHTML = '<i class="bi bi-check2-all me-1"></i> Copied!';
                    targetBtn.classList.remove('btn-custom-accent');
                    targetBtn.classList.add('btn-success');
                    setTimeout(() => {
                        targetBtn.innerHTML = originalHtml;
                        targetBtn.classList.remove('btn-success');
                        targetBtn.classList.add('btn-custom-accent');
                    }, 2000);
                };

                const fallbackCopy = (text: string) => {
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = text;
                        ta.style.position = 'fixed';
                        ta.style.left = '-9999px';
                        document.body.appendChild(ta);
                        ta.focus();
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                        showCopiedFeedback();
                    } catch {
                        showCopiedFeedback();
                    }
                };

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(code).then(showCopiedFeedback).catch(() => fallbackCopy(code));
                } else {
                    fallbackCopy(code);
                }
            }
        });
    });
}

async function recordTransaction(userId: string, type: string, amount: number, description: string, details: any = {}) {
    if (!userId) return;
    const transactionRef = ref(db, `transactions/${userId}`);
    const newTransaction = { type, amount, description, timestamp: serverTimestamp(), ...details };
    try {
        await push(transactionRef, newTransaction);
    } catch (e) {
        console.error("Transaction record failed:", e);
    }
}

async function loadRecentTransactions() {
    if (!currentUser || !elements.recentTransactionsList) return;
    const limit = 25;
    elements.recentTransactionsList.innerHTML = '';
    elements.recentTransactionsList.classList.add('placeholder-glow');
    for (let i = 0; i < 3; i++) {
        elements.recentTransactionsList.innerHTML += `<div class="custom-card p-2 mb-2 placeholder-glow"><div class="d-flex justify-content-between"><span class="placeholder col-5 h-16"></span><span class="placeholder col-3 h-16"></span></div></div>`;
    }

    try {
        await reconcileTransactions(currentUser.uid);
        await syncRedemptionsWithAdminNotes(currentUser.uid);
        const [s, wSnap, depSnap] = await Promise.all([
            get(query(ref(db, `transactions/${currentUser.uid}`), limitToLast(50))),
            get(ref(db, 'withdrawals')).catch(() => null),
            get(ref(db, 'deposits')).catch(() => null)
        ]);
        const transactions = s.val() || {};

        // Identify gift card redemption withdrawalIds, processedAt timestamps, and redeem codes
        // so that gift card redeem code approval notes ONLY show in the Redeem Code section,
        // while normal cash withdrawal approval notes ALWAYS show in Transaction History!
        const giftCardWithdrawalIds = new Set<string>();
        const giftCardProcessedTimestamps = new Set<number>();
        const giftCardCodes = new Set<string>();

        const redMap = userProfile?.redemptions || {};
        for (const [rKey, rVal] of Object.entries(redMap)) {
            if (rVal && typeof rVal === 'object') {
                if ((rVal as any).withdrawalId) giftCardWithdrawalIds.add(String((rVal as any).withdrawalId));
                giftCardWithdrawalIds.add(rKey);
                if ((rVal as any).completedAt) giftCardProcessedTimestamps.add(Number((rVal as any).completedAt));
                const c = String((rVal as any).code || (rVal as any).note || '').trim().toLowerCase();
                if (c) giftCardCodes.add(c);
            }
        }

        // Map withdrawals for user
        const withdrawalsMap = new Map<string, any>();
        if (wSnap && wSnap.exists()) {
            wSnap.forEach((child) => {
                const w = child.val();
                const key = child.key || '';
                if (!w || !key || w.userId !== currentUser?.uid) return;
                withdrawalsMap.set(key, { ...w, id: key });
                if (w.isGiftCard || w.redemptionId || giftCardWithdrawalIds.has(key)) {
                    giftCardWithdrawalIds.add(key);
                    if (w.redemptionId) giftCardWithdrawalIds.add(String(w.redemptionId));
                    if (w.processedAt) giftCardProcessedTimestamps.add(Number(w.processedAt));
                    const note = String(w.adminNote || w.note || w.code || '').trim().toLowerCase();
                    if (note) giftCardCodes.add(note);
                }
            });
        }
        const userWithdrawals = userProfile?.withdrawals || {};
        for (const [key, w] of Object.entries(userWithdrawals)) {
            if (w && typeof w === 'object' && !withdrawalsMap.has(key)) {
                withdrawalsMap.set(key, { ...(w as any), id: key });
            }
        }

        // Map deposits for user
        const depositsMap = new Map<string, any>();
        const depositsByUtr = new Map<string, any>();
        if (depSnap && depSnap.exists()) {
            depSnap.forEach((child) => {
                const d = child.val();
                const key = child.key || '';
                if (!d || !key || d.userId !== currentUser?.uid) return;
                depositsMap.set(key, { ...d, id: key });
                const utr = String(d.utr || '').trim().toLowerCase();
                if (utr) depositsByUtr.set(utr, { ...d, id: key });
            });
        }
        const userDeposits = userProfile?.deposits || {};
        for (const [key, d] of Object.entries(userDeposits)) {
            if (d && typeof d === 'object') {
                if (!depositsMap.has(key)) depositsMap.set(key, { ...(d as any), id: key });
                const utr = String((d as any).utr || '').trim().toLowerCase();
                if (utr && !depositsByUtr.has(utr)) depositsByUtr.set(utr, { ...(d as any), id: key });
            }
        }

        Object.values(transactions).forEach((tx: any) => {
            if (tx && String(tx.type || '').toLowerCase() === 'redeem_gift_card') {
                if (tx.withdrawalId) giftCardWithdrawalIds.add(String(tx.withdrawalId));
                if (tx.redemptionId) giftCardWithdrawalIds.add(String(tx.redemptionId));
            }
        });

        // Collect all transactions, plus synthesized ones for deposits or withdrawals without tx record
        const allItems: any[] = [];
        const seenTxWithdrawalIds = new Set<string>();
        const seenTxDepositIds = new Set<string>();
        const seenTxDepositUtrs = new Set<string>();

        for (const [tKey, t] of Object.entries<any>(transactions)) {
            if (!t || typeof t !== 'object') continue;
            const copy = { ...t, _key: tKey };
            if (copy.withdrawalId) seenTxWithdrawalIds.add(String(copy.withdrawalId));
            if (copy.depositId) seenTxDepositIds.add(String(copy.depositId));
            const utr = String(copy.utr || '').trim().toLowerCase();
            if (utr) seenTxDepositUtrs.add(utr);
            allItems.push(copy);
        }

        // Include any withdrawals from withdrawalsMap not already in transactions
        for (const [wKey, w] of withdrawalsMap.entries()) {
            if (w.isGiftCard || w.redemptionId || giftCardWithdrawalIds.has(wKey)) continue;
            if (!seenTxWithdrawalIds.has(wKey)) {
                allItems.push({
                    _key: `w_${wKey}`,
                    withdrawalId: wKey,
                    type: 'withdraw_request',
                    amount: -Math.abs(Number(w.amount) || 0),
                    description: `Withdrawal Request to ${w.methodDetails?.accountInfo || w.method || 'Bank/UPI'}`,
                    timestamp: w.requestTimestamp || w.timestamp || Date.now(),
                    status: w.status || 'pending',
                    adminNote: w.adminNote || w.note
                });
            }
        }

        // Include any deposits from depositsMap not already in transactions
        for (const [dKey, d] of depositsMap.entries()) {
            const utr = String(d.utr || '').trim().toLowerCase();
            if (!seenTxDepositIds.has(dKey) && (!utr || !seenTxDepositUtrs.has(utr))) {
                allItems.push({
                    _key: `d_${dKey}`,
                    depositId: dKey,
                    type: 'deposit_request',
                    amount: Math.abs(Number(d.amount) || 0),
                    description: `Deposit Request (UTR: ${d.utr || 'N/A'})`,
                    timestamp: d.timestamp || Date.now(),
                    status: d.status || 'pending',
                    utr: d.utr,
                    adminNote: d.adminNote || d.note
                });
            }
        }

        // Identify approved deposit requests so that duplicate generic admin "Deposit" approval records are not shown twice
        const approvedDepositReqs: { amount: number; processedAt?: number; timestamp?: number }[] = [];
        for (const it of allItems) {
            if (it && (it.type === 'deposit_request' || it.depositId || it.utr)) {
                let depRec = it.depositId ? depositsMap.get(String(it.depositId)) : null;
                if (!depRec && it.utr) depRec = depositsByUtr.get(String(it.utr).trim().toLowerCase());
                const st = String(depRec?.status || it.status || '').toLowerCase();
                if (st === 'approved' || st === 'completed' || st === 'successful') {
                    approvedDepositReqs.push({
                        amount: Math.abs(Number(it.amount) || 0),
                        processedAt: Number(depRec?.processedAt) || undefined,
                        timestamp: Number(it.timestamp) || undefined
                    });
                }
            }
        }

        const sortedT = allItems
            .filter((t: any) => {
                if (!t || typeof t !== 'object') return false;
                const txType = String(t.type || '').toLowerCase();
                const desc = String(t.description || '').trim();

                // 1. Deduplicate generic admin "Deposit" tx created when admin approved a deposit request
                const isGenericAdminDepositTx = (
                    (txType === 'deposit_completed' || txType === 'deposit' || txType === 'admin_deposit') &&
                    !t.depositId && !t.utr &&
                    desc.toLowerCase() === 'deposit'
                );
                if (isGenericAdminDepositTx) {
                    const txAmt = Math.abs(Number(t.amount) || 0);
                    const txTime = Number(t.timestamp) || 0;
                    const matchesApprovedReq = approvedDepositReqs.some(req => {
                        if (Math.abs(req.amount - txAmt) > 0.01) return false;
                        if (req.processedAt && Math.abs(req.processedAt - txTime) < 180000) return true;
                        if (req.timestamp && Math.abs(req.timestamp - txTime) < 600000) return true;
                        return false;
                    });
                    if (matchesApprovedReq) return false;
                }

                const isApprovalOrRejectionTx = (
                    txType === 'withdrawal_approved' ||
                    txType === 'withdrawal_rejected' ||
                    (txType === 'withdrawal' && /^withdrawal\s+of\s+/i.test(desc))
                );
                if (isApprovalOrRejectionTx) {
                    if (t.withdrawalId && giftCardWithdrawalIds.has(String(t.withdrawalId))) {
                        return false;
                    }
                    if (t.redemptionId) {
                        return false;
                    }
                    if (t.timestamp && giftCardProcessedTimestamps.has(Number(t.timestamp))) {
                        return false;
                    }
                    const cleanedNote = cleanAdminNoteText(desc).toLowerCase();
                    if (cleanedNote && giftCardCodes.has(cleanedNote)) {
                        return false;
                    }
                }
                return true;
            })
            .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
            .slice(0, limit);

        removePlaceholders(elements.recentTransactionsList);
        elements.recentTransactionsList.innerHTML = '';

        if (sortedT.length > 0) {
            if (elements.noTransactionsMessage) elements.noTransactionsMessage.style.display = 'none';
            sortedT.forEach((t: any) => {
                const item = document.createElement('div');
                item.className = 'custom-card p-2 mb-2 d-flex justify-content-between align-items-center';

                const txType = String(t.type || '').toLowerCase();
                const rawAmount = parseFloat(t.amount) || 0;
                const isDeposit = (
                    txType.includes('deposit') || 
                    Boolean(t.depositId) || 
                    String(t.description || '').toLowerCase().includes('deposit')
                );
                const isWithdrawal = (
                    txType.includes('withdraw') || 
                    Boolean(t.withdrawalId) || 
                    String(t.description || '').toLowerCase().includes('withdrawal')
                );

                let statusBadgeHtml = '';
                let colorClass = 'text-light';
                let amtText = '';
                let adminNoteText = '';

                if (isDeposit) {
                    let depRecord = t.depositId ? depositsMap.get(String(t.depositId)) : null;
                    if (!depRecord && t.utr) {
                        depRecord = depositsByUtr.get(String(t.utr).trim().toLowerCase());
                    }
                    const rawStatus = String(depRecord?.status || t.status || '').toLowerCase();
                    const isApproved = (
                        rawStatus === 'approved' || 
                        rawStatus === 'successful' || 
                        rawStatus === 'completed' || 
                        txType === 'deposit_approved' || 
                        txType === 'deposit_completed' || 
                        txType === 'deposit_successful' || 
                        txType === 'admin_deposit'
                    );
                    const isRejected = (
                        rawStatus === 'rejected' || 
                        rawStatus === 'unsuccessful' || 
                        txType === 'deposit_rejected'
                    );

                    if (depRecord?.rejectReason || depRecord?.adminNote || depRecord?.note || t.adminNote || t.note) {
                        adminNoteText = cleanAdminNoteText(depRecord?.rejectReason || depRecord?.adminNote || depRecord?.note || t.adminNote || t.note);
                    }

                    if (isApproved) {
                        statusBadgeHtml = `<span class="badge bg-success ms-2" style="font-size: 0.68rem;"><i class="bi bi-check-circle-fill me-1"></i>Successful</span>`;
                        colorClass = 'text-success';
                        amtText = `+₹${Math.abs(rawAmount).toFixed(2)}`;
                    } else if (isRejected) {
                        statusBadgeHtml = `<span class="badge bg-danger ms-2" style="font-size: 0.68rem;"><i class="bi bi-x-circle-fill me-1"></i>Unsuccessful</span>`;
                        colorClass = 'text-danger';
                        amtText = `₹${Math.abs(rawAmount).toFixed(2)}`;
                    } else {
                        // Pending
                        statusBadgeHtml = `<span class="badge bg-warning text-dark ms-2" style="font-size: 0.68rem;"><i class="bi bi-clock-history me-1"></i>Pending</span>`;
                        colorClass = 'text-warning';
                        amtText = `+₹${Math.abs(rawAmount).toFixed(2)}`;
                    }
                } else if (isWithdrawal) {
                    const wRecord = t.withdrawalId ? withdrawalsMap.get(String(t.withdrawalId)) : null;
                    const rawStatus = String(wRecord?.status || t.status || '').toLowerCase();
                    const isApproved = (
                        rawStatus === 'approved' || 
                        rawStatus === 'successful' || 
                        rawStatus === 'completed' || 
                        txType === 'withdrawal_approved'
                    );
                    const isRejected = (
                        rawStatus === 'rejected' || 
                        rawStatus === 'unsuccessful' || 
                        txType === 'withdrawal_rejected'
                    );

                    if (wRecord?.rejectReason || wRecord?.adminNote || wRecord?.note || t.adminNote || t.note) {
                        adminNoteText = cleanAdminNoteText(wRecord?.rejectReason || wRecord?.adminNote || wRecord?.note || t.adminNote || t.note);
                    }

                    if (isApproved) {
                        statusBadgeHtml = `<span class="badge bg-success ms-2" style="font-size: 0.68rem;"><i class="bi bi-check-circle-fill me-1"></i>Successful</span>`;
                        colorClass = 'text-success';
                        amtText = `-₹${Math.abs(rawAmount).toFixed(2)}`;
                    } else if (isRejected) {
                        statusBadgeHtml = `<span class="badge bg-danger ms-2" style="font-size: 0.68rem;"><i class="bi bi-x-circle-fill me-1"></i>Unsuccessful</span>`;
                        colorClass = 'text-danger';
                        amtText = `₹${Math.abs(rawAmount).toFixed(2)}`;
                    } else {
                        // Pending
                        statusBadgeHtml = `<span class="badge bg-warning text-dark ms-2" style="font-size: 0.68rem;"><i class="bi bi-clock-history me-1"></i>Pending</span>`;
                        colorClass = 'text-warning';
                        amtText = `-₹${Math.abs(rawAmount).toFixed(2)}`;
                    }
                } else {
                    const isDebitType = (
                        txType === 'tournament_join' ||
                        txType === 'join_tournament' ||
                        txType === 'subscription_purchase' ||
                        txType === 'redeem_gift_card' ||
                        txType === 'debit'
                    );
                    const isCr = !isDebitType && rawAmount > 0;
                    colorClass = isCr ? 'text-success' : 'text-danger';
                    amtText = `${isCr ? '+' : '-'}₹${Math.abs(rawAmount).toFixed(2)}`;
                    if (txType === 'tournament_winnings') {
                        statusBadgeHtml = `<span class="badge bg-success ms-2" style="font-size: 0.68rem;"><i class="bi bi-trophy-fill me-1"></i>Won</span>`;
                    }
                }

                const time = t.timestamp ? new Date(t.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
                const desc = escapeHtml(t.description || t.type || 'Transaction');
                const noteHtml = adminNoteText ? `<div class="small text-secondary mt-0.5" style="font-size: 0.72rem;"><i class="bi bi-info-circle me-1"></i>${escapeHtml(adminNoteText)}</div>` : '';

                item.innerHTML = `
                    <div class="me-2 text-truncate">
                        <div class="d-flex align-items-center flex-wrap">
                            <span class="small fw-bold text-light text-truncate">${desc}</span>
                            ${statusBadgeHtml}
                        </div>
                        <div class="small text-secondary mt-0.5" style="font-size: 0.73rem;">${time}</div>
                        ${noteHtml}
                    </div>
                    <div class="fw-bold ${colorClass} text-nowrap ms-2" style="font-size: 1rem;">${amtText}</div>
                `;
                elements.recentTransactionsList.appendChild(item);
            });
        } else if (elements.noTransactionsMessage) {
            elements.noTransactionsMessage.style.display = 'block';
            elements.noTransactionsMessage.textContent = 'No recent transactions.';
        }
    } catch (e) {
        console.error("Transactions load failed:", e);
        removePlaceholders(elements.recentTransactionsList);
    }
}

function handleWithdrawClick() {
    if (!currentUser || !elements.withdrawModalInstance) return;
    const balances = extractBalances(userProfile);
    const wc = balances.winning;
    const minW = appSettings?.minWithdraw || 50;
    elements.minWithdrawAmount.textContent = String(minW);
    elements.withdrawModalBalance.textContent = `₹${wc.toFixed(2)}`;
    elements.withdrawAmountInput.value = '';
    elements.withdrawAmountInput.min = String(minW);
    elements.withdrawMethodInput.value = userProfile.upiId || '';
    clearStatusMessage(elements.withdrawStatusMessage);
    elements.withdrawModalInstance.show();
}

let isSubmittingWithdraw = false;

async function submitWithdrawRequestHandler() {
    if (!currentUser || !elements.withdrawModalInstance || isSubmittingWithdraw) return;
    const amt = parseFloat(elements.withdrawAmountInput.value);
    const mtd = elements.withdrawMethodInput.value.trim();
    const balances = extractBalances(userProfile);
    const wc = balances.winning;
    const minW = appSettings?.minWithdraw || 50;
    clearStatusMessage(elements.withdrawStatusMessage);

    if (isNaN(amt) || amt <= 0) {
        showStatusMessage(elements.withdrawStatusMessage, 'Invalid amount.', 'warning');
        return;
    }
    if (amt < minW) {
        showStatusMessage(elements.withdrawStatusMessage, `Min withdraw is ₹${minW}.`, 'warning');
        return;
    }
    if (amt > wc) {
        showStatusMessage(elements.withdrawStatusMessage, 'Insufficient winning balance.', 'warning');
        return;
    }
    if (!mtd) {
        showStatusMessage(elements.withdrawStatusMessage, 'Enter withdrawal method (UPI ID or Bank).', 'warning');
        return;
    }

    isSubmittingWithdraw = true;
    elements.submitWithdrawRequestBtn.disabled = true;
    elements.submitWithdrawRequestBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sending...';

    try {
        const uRef = ref(db, `users/${currentUser.uid}`);
        await get(uRef);
        let insufficientWinning = false;
        const txRes = await runTransaction(uRef, (prof) => {
            if (!prof) return prof;
            const pBalances = extractBalances(prof);
            if (pBalances.winning < amt) {
                insufficientWinning = true;
                return;
            }
            prof.winningCash = Math.max(0, pBalances.winning - amt);
            prof.depositBalance = pBalances.deposit;
            prof.bonusCash = pBalances.bonus;
            prof.balance = prof.depositBalance + prof.winningCash + prof.bonusCash;
            prof.walletBalance = prof.balance;
            return prof;
        });

        if (insufficientWinning || !txRes.committed) {
            throw new Error("Insufficient winning balance.");
        }

        if (txRes.snapshot.exists()) {
            userProfile = txRes.snapshot.val();
            populateUserInfo(currentUser, userProfile);
        }

        const wrRef = ref(db, 'withdrawals');
        const newReq = {
            userId: currentUser.uid,
            userName: userProfile.displayName || currentUser.email,
            amount: amt,
            methodDetails: { methodName: mtd.includes('@') ? 'UPI' : 'Bank', accountInfo: mtd },
            status: 'pending',
            requestTimestamp: serverTimestamp(),
            userEmail: currentUser.email || 'N/A'
        };
        const newWithdrawalRef = await push(wrRef, newReq);
        await recordTransaction(currentUser.uid, 'withdraw_request', -amt, `Withdrawal Request to ${mtd}`, { 
            withdrawalId: newWithdrawalRef.key,
            status: 'pending'
        });
        set(ref(db, `users/${currentUser.uid}/withdrawals/${newWithdrawalRef.key}`), {
            ...newReq,
            id: newWithdrawalRef.key
        }).catch(() => {});

        showStatusMessage(elements.withdrawStatusMessage, 'Withdrawal request submitted successfully! Processed within 2-24 hours.', 'success', false);
        setTimeout(() => {
            elements.withdrawModalInstance?.hide();
        }, 2000);
        if (currentSectionId === 'wallet-section') loadRecentTransactions();
    } catch (e: any) {
        showStatusMessage(elements.withdrawStatusMessage, `Error: ${e.message}`, 'danger');
    } finally {
        isSubmittingWithdraw = false;
        elements.submitWithdrawRequestBtn.disabled = false;
        elements.submitWithdrawRequestBtn.innerHTML = 'Submit Request';
    }
}

async function handleMatchDetailsClick(event: any) {
    if (!elements.matchDetailsModalInstance) return;
    const tId = event.currentTarget.dataset.tournamentId;
    if (!tId) return;

    elements.matchDetailsModalTitle.textContent = 'Loading...';
    elements.matchDetailsModalBody.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-accent"></div></div>';
    elements.matchDetailsModalInstance.show();

    try {
        const tRef = ref(db, `tournaments/${tId}`);
        const s = await get(tRef);
        if (s.exists()) {
            const t = s.val();
            const gName = appSettings.games?.[t.gameId]?.name || t.gameId || 'Esports Match';
            const sTimeLoc = t.startTime ? new Date(t.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'TBA';
            let pDistHTML = '';
            if (t.prizeDistribution) {
                let fmtDist = '';
                if (typeof t.prizeDistribution === 'object') {
                    fmtDist = Object.entries(t.prizeDistribution).map(([rank, prize]) => `Rank ${rank}: ₹${prize}`).join('\n');
                } else {
                    fmtDist = String(t.prizeDistribution).replace(/\\n/g, '\n');
                }
                pDistHTML = `<h5>Prize Distribution:</h5><pre>${fmtDist}</pre>`;
            }
            const desc = t.description || 'Standard tournament rules apply.';
            const regPlayers = t.registeredPlayers || {};
            const isJoined = Boolean(
                currentUser && (
                    userProfile?.joinedTournaments?.[tId] ||
                    regPlayers[currentUser.uid]
                )
            );

            const matchResults = extractTournamentResults(tId, t);
            const isResultAnnounced = matchResults.isAnnounced || t.status === 'completed' || t.status === 'result' || Boolean(t.winningsCredited);

            // Create a lookup for winners by uid or username
            const winnerMapByUid = new Map<string, TournamentWinner>();
            const winnerMapByName = new Map<string, TournamentWinner>();
            matchResults.winners.forEach(w => {
                if (w.uid) winnerMapByUid.set(w.uid, w);
                if (w.username) winnerMapByName.set(w.username.toLowerCase(), w);
            });

            // Fetch live synced results from server if completed / result announced
            let apiWinningsMap: Record<string, { wonAmount: number; kills: number; rank: number }> = {};
            if (isResultAnnounced) {
                try {
                    const apiRes = await fetch(`/api/tournaments/${tId}/results`);
                    if (apiRes.ok) {
                        const apiData = await apiRes.json();
                        if (apiData && Array.isArray(apiData.winners)) {
                            apiData.winners.forEach((w: any) => {
                                const wObj: TournamentWinner = {
                                    rank: Number(w.rank) || 0,
                                    username: w.username || 'Player',
                                    uid: w.uid,
                                    kills: Number(w.kills) || 0,
                                    prize: Number(w.wonAmount) || 0,
                                    killPrize: 0,
                                    wonAmount: Number(w.wonAmount) || 0,
                                    isCurrentUser: Boolean(currentUser && currentUser.uid === w.uid)
                                };
                                if (w.uid && (!winnerMapByUid.has(w.uid) || (winnerMapByUid.get(w.uid)!.wonAmount < wObj.wonAmount))) {
                                    winnerMapByUid.set(w.uid, wObj);
                                }
                                if (w.username && (!winnerMapByName.has(w.username.toLowerCase()) || (winnerMapByName.get(w.username.toLowerCase())!.wonAmount < wObj.wonAmount))) {
                                    winnerMapByName.set(w.username.toLowerCase(), wObj);
                                }
                            });
                        }
                        if (apiData && apiData.participantsWinnings) {
                            apiWinningsMap = apiData.participantsWinnings;
                        }
                    }
                } catch (_) {}
            }

            // Sync updated winners into matchResults if initially empty or more winners found
            if (winnerMapByUid.size > matchResults.winners.length) {
                matchResults.winners = Array.from(winnerMapByUid.values()).filter(w => w.wonAmount > 0);
                matchResults.winners.sort((a, b) => {
                    if (a.rank && b.rank && a.rank !== b.rank) return a.rank - b.rank;
                    return b.wonAmount - a.wonAmount;
                });
            }

            let winnersSectionHTML = '';
            if (isResultAnnounced) {
                if (matchResults.winners.length > 0) {
                    const winnerRows = matchResults.winners.map((w, idx) => {
                        let medal = `${idx + 1}.`;
                        if (w.rank === 1) medal = '🥇 #1';
                        else if (w.rank === 2) medal = '🥈 #2';
                        else if (w.rank === 3) medal = '🥉 #3';
                        else if (w.rank) medal = `#${w.rank}`;

                        const isMe = w.isCurrentUser || (currentUser && w.uid === currentUser.uid);

                        return `
                            <div class="d-flex align-items-center justify-content-between py-2 px-2.5 ${idx < matchResults.winners.length - 1 ? 'border-bottom border-secondary border-opacity-25' : ''}">
                                <div class="d-flex align-items-center gap-2">
                                    <span class="badge ${w.rank <= 3 ? 'bg-warning text-dark' : 'bg-dark border border-secondary text-light'} fw-bold" style="min-width: 48px;">${medal}</span>
                                    <div>
                                        <div class="fw-semibold text-light">
                                            ${escapeHtml(w.username)}
                                            ${isMe ? '<span class="badge bg-success ms-1" style="font-size: 0.65rem;">You</span>' : ''}
                                        </div>
                                        ${w.teammateUsername ? `<div class="small text-info" style="font-size: 0.72rem;"><i class="bi bi-people-fill me-1"></i>Teammate: ${escapeHtml(w.teammateUsername)}</div>` : ''}
                                    </div>
                                    ${w.kills > 0 ? `<span class="badge bg-danger ms-1" style="font-size: 0.65rem;">${w.kills} Kills</span>` : ''}
                                </div>
                                <div class="text-end">
                                    <strong class="text-success fw-bold d-block" style="font-size: 1.05rem;">+₹${w.wonAmount.toFixed(2)}</strong>
                                    <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50" style="font-size: 0.65rem;">Won Prize</span>
                                </div>
                            </div>
                        `;
                    }).join('');

                    winnersSectionHTML = `
                        <div class="match-results-box p-3 mb-3 rounded" style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.18), rgba(234, 179, 8, 0.12)); border: 1px solid rgba(34, 197, 94, 0.45);">
                            <div class="d-flex align-items-center justify-content-between mb-2">
                                <h5 class="fw-bold text-success mb-0"><i class="bi bi-trophy-fill text-warning me-2"></i>Official Match Winners</h5>
                                <span class="badge bg-success text-white px-2 py-1"><i class="bi bi-check-circle-fill me-1"></i>Announced</span>
                            </div>
                            <p class="small text-light mb-2">Tournament result has been announced! Here is the list of players who won and how much they won:</p>
                            <div class="mt-2" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 10px; max-height: 260px; overflow-y: auto;">
                                ${winnerRows}
                            </div>
                        </div>
                    `;
                } else {
                    winnersSectionHTML = `
                        <div class="alert alert-success p-3 mb-3 rounded border border-success">
                            <h6 class="fw-bold text-success mb-1"><i class="bi bi-check-circle-fill me-1"></i> Tournament Completed</h6>
                            <p class="small text-light mb-0">This match is completed. Winnings have been credited to winners' wallets by admin.</p>
                        </div>
                    `;
                }

                if (matchResults.resultNote) {
                    winnersSectionHTML += `
                        <div class="alert alert-dark p-2.5 mb-3 border border-secondary small" style="white-space: pre-wrap;">
                            <strong class="text-warning d-block mb-1"><i class="bi bi-megaphone-fill me-1"></i>Admin Announcement:</strong>
                            ${escapeHtml(matchResults.resultNote)}
                        </div>
                    `;
                }
            }

            let participantsHTML = '';
            if (isJoined || Object.keys(regPlayers).length > 0) {
                const rawEntries = Object.entries(regPlayers);
                if (isJoined && currentUser && !regPlayers[currentUser.uid]) {
                    rawEntries.push([currentUser.uid, {
                        username: userProfile?.username || userProfile?.displayName || currentUser.email?.split('@')[0] || 'Player',
                        displayName: userProfile?.displayName || userProfile?.username || 'Player',
                        joinedAt: Date.now()
                    }]);
                }

                rawEntries.sort(([, a]: any, [, b]: any) => {
                    const tA = (a && typeof a === 'object' && typeof a.joinedAt === 'number') ? a.joinedAt : 0;
                    const tB = (b && typeof b === 'object' && typeof b.joinedAt === 'number') ? b.joinedAt : 0;
                    return tA - tB;
                });

                const resolvedParticipants = await Promise.all(rawEntries.map(async ([uid, pData]: [string, any]) => {
                    let pName = '';
                    let teammateName = '';
                    let pRank: number | undefined;
                    let pWonAmount = 0;
                    let pKills = 0;

                    if (pData && typeof pData === 'object') {
                        pName = pData.username || pData.displayName || pData.name || '';
                        teammateName = pData.teammateUsername || '';
                        if (pData.rank) pRank = Number(pData.rank);
                        pKills = Number(pData.kills || 0);
                        pWonAmount = Number(pData.wonAmount || pData.totalWon || pData.winning || pData.winnings || pData.prize || pData.won || 0);
                    } else if (typeof pData === 'string') {
                        pName = pData;
                    }

                    // Check winnerMap
                    const matchedWinner = winnerMapByUid.get(uid) || (pName ? winnerMapByName.get(pName.toLowerCase()) : undefined);
                    if (matchedWinner) {
                        if (matchedWinner.wonAmount > pWonAmount) pWonAmount = matchedWinner.wonAmount;
                        if (matchedWinner.rank && !pRank) pRank = matchedWinner.rank;
                        if (matchedWinner.kills && !pKills) pKills = matchedWinner.kills;
                    }

                    // Check apiWinningsMap (synced from tournament prize management)
                    if (apiWinningsMap[uid]) {
                        const aw = apiWinningsMap[uid];
                        if (aw.wonAmount > pWonAmount) pWonAmount = aw.wonAmount;
                        if (aw.rank && !pRank) pRank = aw.rank;
                        if (aw.kills && !pKills) pKills = aw.kills;
                    }

                    // Check current logged-in user matchHistory
                    if (currentUser && currentUser.uid === uid && userProfile?.matchHistory?.[tId]) {
                        const myMh = userProfile.matchHistory[tId];
                        const myWon = Number(myMh.earnings ?? myMh.wonAmount ?? myMh.prize ?? 0);
                        if (myWon > pWonAmount) pWonAmount = myWon;
                        if (myMh.rank && !pRank) pRank = Number(myMh.rank);
                        if (myMh.kills && !pKills) pKills = Number(myMh.kills);
                    }

                    if (!pName) {
                        try {
                            const uSnap = await get(ref(db, `users/${uid}`));
                            if (uSnap.exists()) {
                                const uVal = uSnap.val();
                                pName = uVal.username || uVal.displayName || (uVal.email ? uVal.email.split('@')[0] : '');
                            }
                        } catch {}
                    }
                    if (!pName) pName = `Player_${uid.slice(-4)}`;

                    return {
                        uid,
                        name: pName,
                        teammateName,
                        rank: pRank,
                        kills: pKills,
                        wonAmount: pWonAmount,
                        isMe: Boolean(currentUser && currentUser.uid === uid)
                    };
                }));

                const rowsHtml = resolvedParticipants.map((p, idx) => {
                    let winningBadge = '';
                    if (isResultAnnounced) {
                        if (p.wonAmount > 0) {
                            const amtStr = p.wonAmount % 1 === 0 ? p.wonAmount.toString() : p.wonAmount.toFixed(2);
                            winningBadge = `<span class="badge bg-success ms-auto fw-bold" style="font-size: 0.78rem;"><i class="bi bi-trophy-fill me-1"></i>Won ₹${amtStr}</span>`;
                        } else {
                            winningBadge = `<span class="badge bg-dark border border-secondary text-secondary ms-auto" style="font-size: 0.72rem;">${p.rank && p.rank > 0 ? `Rank #${p.rank} · Won ₹0` : 'Won ₹0'}</span>`;
                        }
                    }

                    return `
                        <div class="d-flex align-items-center justify-content-between py-2 px-2 ${idx < resolvedParticipants.length - 1 ? 'border-bottom border-secondary border-opacity-25' : ''}">
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge bg-dark border border-warning text-warning fw-bold" style="min-width: 34px;">${idx + 1}.</span>
                                <div>
                                    <span class="fw-semibold text-light">${escapeHtml(p.name)}</span>
                                    ${p.isMe ? '<span class="badge bg-success ms-1" style="font-size: 0.65rem;">You</span>' : ''}
                                    ${p.teammateName ? `<div class="small text-info" style="font-size: 0.72rem;"><i class="bi bi-people-fill me-1"></i>${escapeHtml(p.teammateName)}</div>` : ''}
                                </div>
                            </div>
                            ${winningBadge}
                        </div>
                    `;
                }).join('');

                participantsHTML = `
                    <hr>
                    <h5 class="d-flex align-items-center justify-content-between mb-2">
                        <span><i class="bi bi-people-fill text-accent me-1"></i> Joined Participants (${resolvedParticipants.length})</span>
                        ${isResultAnnounced ? '<span class="badge bg-info text-dark">Results &amp; Winnings</span>' : '<span class="badge bg-warning text-dark rounded-pill">Joined</span>'}
                    </h5>
                    <div class="mt-2" style="max-height: 250px; overflow-y: auto; background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; padding: 8px 10px;">
                        ${rowsHtml}
                    </div>
                `;
            }

            elements.matchDetailsModalTitle.innerHTML = isResultAnnounced
                ? `<i class="bi bi-trophy-fill text-warning me-2"></i>${escapeHtml(t.name || 'Match Details')} - Results`
                : `${escapeHtml(t.name || 'Match Details')}`;

            elements.matchDetailsModalBody.innerHTML = `
                ${winnersSectionHTML}
                <div class="custom-card p-3 mb-3">
                    <p class="mb-1"><strong>Game:</strong> ${gName}</p>
                    <p class="mb-1"><strong>Mode:</strong> ${t.mode || 'N/A'}</p>
                    <p class="mb-1"><strong>Map:</strong> ${t.map || 'N/A'}</p>
                    <p class="mb-1"><strong>Starts:</strong> ${sTimeLoc}</p>
                    <hr class="my-2">
                    <p class="mb-1"><strong>Entry Fee:</strong> ${t.entryFee > 0 ? `₹${t.entryFee}` : 'Free'}</p>
                    <p class="mb-1"><strong>Prize Pool:</strong> ₹${t.prizePool || 0}</p>
                    <p class="mb-1"><strong>Per Kill:</strong> ₹${t.perKillPrize || 0}</p>
                </div>
                ${pDistHTML}
                <h5>Rules & Info:</h5>
                <div class="mb-3" style="white-space: pre-wrap; line-height: 1.6;">${desc}</div>
                ${participantsHTML}`;
        } else {
            elements.matchDetailsModalBody.innerHTML = '<p class="text-danger">Match details not found.</p>';
        }
    } catch (e) {
        elements.matchDetailsModalBody.innerHTML = '<p class="text-danger">Error loading match details.</p>';
    }
}

async function handleIdPasswordClick(event: any) {
    if (!elements.idPasswordModalInstance) return;
    const tId = event.currentTarget.dataset.tournamentId;
    if (!tId) return;

    elements.roomIdDisplay.innerHTML = '<span class="placeholder col-6"></span>';
    elements.roomPasswordDisplay.innerHTML = '<span class="placeholder col-6"></span>';
    elements.idPasswordModalInstance.show();

    try {
        const s = await get(ref(db, `tournaments/${tId}`));
        removePlaceholders(elements.roomIdDisplay.closest('.placeholder-glow'));
        removePlaceholders(elements.roomPasswordDisplay.closest('.placeholder-glow'));
        if (s.exists()) {
            const tournamentData = s.val();
            if (tournamentData.showIdPass) {
                elements.roomIdDisplay.textContent = tournamentData.roomId || 'Not updated yet';
                elements.roomPasswordDisplay.textContent = tournamentData.roomPassword || 'Not updated yet';
            } else {
                elements.roomIdDisplay.textContent = 'Room ID will show 10-15m before start';
                elements.roomPasswordDisplay.textContent = 'Password will show 10-15m before start';
            }
        }
    } catch (e) {
        elements.roomIdDisplay.textContent = 'Error';
        elements.roomPasswordDisplay.textContent = 'Error';
    }
}

/* =========================================================
   POLICY & REFER SECTION (MENTION ₹10 ON 1ST PAID CONTEST)
   ========================================================= */
async function handlePolicyClick(event: any) {
    if (!elements.policyModalInstance) return;
    event.preventDefault();
    const policyType = event.currentTarget.dataset.policy;
    if (!policyType) return;

    let title = '';
    let modalBodyContent = '<div class="text-center p-5"><div class="spinner-border text-accent"></div></div>';
    elements.policyModalBody.innerHTML = modalBodyContent;

    switch (policyType) {
        case 'privacy':
            title = 'Privacy Policy';
            modalBodyContent = appSettings.policyPrivacy || 'We respect your privacy and protect your user data securely.';
            break;
        case 'terms':
            title = 'Terms and Conditions';
            modalBodyContent = appSettings.policyTerms || 'By joining contests, you agree to abide by fair play rules and esports conduct.';
            break;
        case 'refund':
            title = 'Refund and Cancellation';
            modalBodyContent = appSettings.policyRefund || 'Cancelled tournaments are refunded 100% back to your deposit balance.';
            break;
        case 'fairPlay':
            title = 'Fair Play Policy';
            modalBodyContent = appSettings.policyFairPlay || 'Hacks, emulators or illegal scripts lead to immediate account ban.';
            break;
        case 'refer':
            title = 'Refer & Earn Program';
            if (!currentUser) {
                alert("Please login to view your referral code.");
                return;
            }
            const refCode = userProfile.referralCode || 'N/A';
            modalBodyContent = `
                <div class="text-center">
                    <div style="background: linear-gradient(135deg, rgba(250, 204, 21, 0.2), rgba(245, 158, 11, 0.1)); padding: 20px; border-radius: 12px; border: 1px solid var(--accent-color);">
                        <i class="bi bi-gift-fill text-accent display-4 mb-2 d-block"></i>
                        <h4 class="fw-bold text-accent">Refer Friends & Earn ₹10 Cash!</h4>
                        <p class="text-light small">Share your referral code. <strong class="text-accent">Get 10 rs when friend join 1 paid contest!</strong> Jab aapka friend signup karke apna 1st Paid Contest join karega, aapko turant ₹10 wallet cash milega.</p>
                        
                        <div class="my-3 p-3" style="background: var(--primary-bg); border-radius: 8px;">
                            <p class="small text-secondary mb-1">Your Referral Code:</p>
                            <h3 class="text-accent referral-code" id="referralCodeDisplay">${refCode}</h3>
                            <div class="mt-3">
                                <button class="btn btn-sm btn-custom btn-custom-secondary me-2 copy-btn" data-target="#referralCodeDisplay"><i class="bi bi-clipboard"></i> Copy Code</button>
                                <button class="btn btn-sm btn-custom btn-custom-accent" id="shareReferralBtn"><i class="bi bi-share-fill"></i> Share on WhatsApp</button>
                            </div>
                        </div>

                        <div class="text-start small text-secondary mt-3 p-3 rounded bg-dark">
                            <h6 class="text-light fw-bold mb-2"><i class="bi bi-info-circle-fill text-accent me-1"></i> Refer & Earn Rules:</h6>
                            <ul class="mb-0 ps-3" style="line-height: 1.8;">
                                <li>Friend must signup using your referral code.</li>
                                <li>Friend gets <strong class="text-light">₹10 Welcome Bonus</strong>.</li>
                                <li><strong class="text-success">Get 10 rs when friend join 1 paid contest</strong> (Aapko ₹10 tab milega jab friend apna 1st Paid Contest successfully join karega).</li>
                                <li>Top 10 referrers ko Leaderboard me Monthly Cash Prizes bhi milenge! 🏆</li>
                            </ul>
                        </div>
                    </div>
                </div>`;
            break;
    }

    elements.policyModalTitle.textContent = title;
    elements.policyModalBody.innerHTML = modalBodyContent;
    elements.policyModalInstance.show();
}

function setupRealtimeListeners(uid: string) {
    if (!uid || !db) return;
    detachAllDbListeners();

    // 1. User Profile Listener
    const uRef = ref(db, `users/${uid}`);
    const listFunc = onValue(uRef, (s) => {
        if (currentUser && currentUser.uid === uid) {
            if (s.exists()) {
                userProfile = s.val();
                populateUserInfo(currentUser, userProfile);
                syncRedemptionsWithAdminNotes(uid);
                if (currentSectionId === 'home-section') loadMyContests();
                if (currentSectionId === 'wallet-section') loadRecentTransactions();
            }
        }
    });
    dbListeners['userProfile'] = { path: `users/${uid}`, func: listFunc };

    // 2. Presence Tracking (Online status & lastSeen)
    const connectedRef = ref(db, '.info/connected');
    const connFunc = onValue(connectedRef, (snap) => {
        if (snap.val() === true && currentUser && currentUser.uid === uid) {
            const userStatusRef = ref(db, `users/${uid}`);
            update(userStatusRef, { isOnline: true }).catch(() => {});
            try {
                onDisconnect(userStatusRef).update({
                    isOnline: false,
                    lastSeen: serverTimestamp()
                }).catch(() => {});
            } catch (e) {}
        }
    });
    dbListeners['connected'] = { path: '.info/connected', func: connFunc };

    // 3. Friend Requests Listener (Pending Count Badge)
    const reqRef = ref(db, `users/${uid}/incomingRequests`);
    const reqFunc = onValue(reqRef, async (snap) => {
        if (!currentUser || currentUser.uid !== uid) return;
        const rawReqs: any[] = [];
        if (snap.exists()) {
            snap.forEach((child) => {
                const val = child.val();
                const sUid = val?.senderUid || child.key;
                if (val && typeof val === 'object' && sUid && val.status !== 'cancelled' && val.status !== 'rejected' && val.status !== 'accepted') {
                    rawReqs.push({ ...val, senderUid: sUid, key: child.key });
                }
            });
        }
        const requestsList: any[] = [];
        if (rawReqs.length > 0) {
            const checks = await Promise.allSettled(
                rawReqs.map(r => get(ref(db, `users/${r.senderUid}/sentFriendRequests/${uid}`)))
            );
            for (let i = 0; i < rawReqs.length; i++) {
                const r = rawReqs[i];
                const chkRes = checks[i];
                if (chkRes.status === 'fulfilled') {
                    const chkSnap = chkRes.value;
                    if (chkSnap.exists() && chkSnap.val()?.status === 'pending') {
                        requestsList.push(r);
                    } else {
                        set(ref(db, `users/${uid}/incomingRequests/${r.senderUid}`), { status: 'cancelled', senderUid: r.senderUid, cancelledAt: Date.now() }).catch(() => {});
                        remove(ref(db, `users/${uid}/incomingRequests/${r.senderUid}`)).catch(() => {});
                    }
                } else {
                    requestsList.push(r);
                }
            }
        }
        const count = requestsList.length;
        if (elements.friendRequestsBadge) {
            elements.friendRequestsBadge.textContent = String(count);
            elements.friendRequestsBadge.style.display = count > 0 ? 'inline-block' : 'none';
        }
        if (elements.friendsSectionRequestsBadge) {
            elements.friendsSectionRequestsBadge.textContent = String(count);
            elements.friendsSectionRequestsBadge.style.display = count > 0 ? 'inline-block' : 'none';
        }
        if (currentSectionId === 'friend-requests-section') {
            renderFriendRequestsList(requestsList);
        }
    });
    dbListeners['friendRequests'] = { path: `users/${uid}/incomingRequests`, func: reqFunc };

    // Realtime signals listener under chats/sig_${uid}
    const sigRef = query(ref(db, `chats/sig_${uid}`), limitToLast(50));
    const sigFunc = onChildAdded(sigRef, async (snap) => {
        const sig = snap.val();
        const sigKey = snap.key || '';
        if (!sig || !currentUser || currentUser.uid !== uid) return;
        if (sigKey && processedSignalKeys.has(sigKey)) return;
        if (sigKey) processedSignalKeys.add(sigKey);

        const consumeSignal = async () => {
            if (sigKey) {
                await remove(ref(db, `chats/sig_${uid}/${sigKey}`)).catch(() => {});
            }
        };

        const senderUid = sig.senderUid;
        if (!senderUid || senderUid === uid) {
            await consumeSignal();
            return;
        }

        const pairId = getChatPairId(uid, senderUid);

        if (sig.type === 'friend_request') {
            try {
                const [chk, friendChk, relSnap] = await Promise.all([
                    get(ref(db, `users/${senderUid}/sentFriendRequests/${uid}`)).catch(() => null),
                    get(ref(db, `users/${uid}/friends/${senderUid}`)).catch(() => null),
                    get(ref(db, `chats/rel_${pairId}`)).catch(() => null)
                ]);
                const relVal = relSnap && relSnap.exists() ? relSnap.val() : null;
                const isSenderPending = Boolean(chk && chk.exists() && chk.val()?.status === 'pending');
                const isAlreadyFriends = (friendChk && friendChk.exists() && relVal?.status !== 'unfriended') || (relVal && relVal.status === 'friends');

                if (isSenderPending && !isAlreadyFriends) {
                    const senderSnap = await get(ref(db, `users/${senderUid}`)).catch(() => null);
                    const sVal = (senderSnap && senderSnap.exists()) ? senderSnap.val() : {};
                    const sName = sVal.displayName || sig.senderName || 'Player';
                    const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(sName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;
                    const sPhoto = resolveUserAvatarUrl(sVal, sig.senderPhoto || defaultPhoto);
                    const reqTs = Number(chk?.val()?.timestamp) || Number(sig.timestamp) || Date.now();

                    await remove(ref(db, `users/${uid}/removedFriends/${senderUid}`)).catch(() => {});
                    await remove(ref(db, `users/${uid}/rejectedRequests/${senderUid}`)).catch(() => {});
                    await set(ref(db, `users/${uid}/incomingRequests/${senderUid}`), {
                        senderUid,
                        senderName: sName,
                        senderPhoto: sPhoto,
                        status: 'pending',
                        timestamp: reqTs
                    });
                    if (currentInspectedUser?.uid === senderUid) {
                        updateProfileFriendActionButton(currentInspectedUser);
                    }
                    const sTs = extractNotifTimestamp(sig);
                    if (sTs > appSessionStartTime || !sTs) {
                        triggerSystemNotification(`Friend Request: ${sName}`, {
                            body: `${sName} sent you a friend request.`,
                            icon: sPhoto,
                            tag: `friend_req_${senderUid}`
                        });
                    }
                }
            } catch (e) {}
            await consumeSignal();
        } else if (sig.type === 'friend_accepted') {
            try {
                const relSnap = await get(ref(db, `chats/rel_${pairId}`)).catch(() => null);
                const relVal = relSnap && relSnap.exists() ? relSnap.val() : null;
                if (relVal && relVal.status === 'unfriended') {
                    await consumeSignal();
                    return;
                }
                const senderSnap = await get(ref(db, `users/${senderUid}`)).catch(() => null);
                const sVal = (senderSnap && senderSnap.exists()) ? senderSnap.val() : {};
                const sName = sVal.displayName || sig.senderName || 'Player';
                const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(sName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;
                const sPhoto = resolveUserAvatarUrl(sVal, sig.senderPhoto || defaultPhoto);

                await remove(ref(db, `users/${uid}/removedFriends/${senderUid}`)).catch(() => {});
                await remove(ref(db, `users/${uid}/rejectedRequests/${senderUid}`)).catch(() => {});
                await set(ref(db, `users/${uid}/friends/${senderUid}`), {
                    friendUid: senderUid,
                    displayName: sName,
                    photoURL: sPhoto,
                    addedAt: Date.now()
                });
                await set(ref(db, `users/${uid}/sentFriendRequests/${senderUid}`), { status: 'accepted', targetUid: senderUid }).catch(() => {});
                await remove(ref(db, `users/${uid}/sentFriendRequests/${senderUid}`)).catch(() => {});
                await set(ref(db, `users/${uid}/incomingRequests/${senderUid}`), { status: 'accepted', senderUid }).catch(() => {});
                await remove(ref(db, `users/${uid}/incomingRequests/${senderUid}`)).catch(() => {});

                if (currentInspectedUser?.uid === senderUid) {
                    updateProfileFriendActionButton(currentInspectedUser);
                }
                if (currentSectionId === 'friends-section') loadFriendsData();
                if (currentSectionId === 'friend-requests-section') loadFriendRequestsData();
            } catch (e) {}
            await consumeSignal();
        } else if (sig.type === 'friend_removed') {
            try {
                const relSnap = await get(ref(db, `chats/rel_${pairId}`)).catch(() => null);
                const relVal = relSnap && relSnap.exists() ? relSnap.val() : null;
                if (relVal && relVal.status === 'friends' && Number(relVal.acceptedAt || 0) > Number(sig.timestamp || 0)) {
                    await consumeSignal();
                    return;
                }
                await set(ref(db, `users/${uid}/removedFriends/${senderUid}`), Number(sig.timestamp) || Date.now()).catch(() => {});
                await remove(ref(db, `users/${uid}/friends/${senderUid}`)).catch(() => {});
                await set(ref(db, `users/${uid}/incomingRequests/${senderUid}`), { status: 'cancelled', senderUid }).catch(() => {});
                await remove(ref(db, `users/${uid}/incomingRequests/${senderUid}`)).catch(() => {});
                await set(ref(db, `users/${uid}/sentFriendRequests/${senderUid}`), { status: 'cancelled', targetUid: senderUid }).catch(() => {});
                await remove(ref(db, `users/${uid}/sentFriendRequests/${senderUid}`)).catch(() => {});
                await remove(ref(db, `users/${uid}/conversations/${senderUid}`)).catch(() => {});

                if (activePersonalChatFriend?.uid === senderUid) {
                    closePersonalChat();
                }
                if (currentInspectedUser?.uid === senderUid) {
                    updateProfileFriendActionButton(currentInspectedUser);
                }
                if (currentSectionId === 'friends-section') loadFriendsData();
                if (currentSectionId === 'messages-section') loadConversationsData();
            } catch (e) {}
            await consumeSignal();
        } else if (sig.type === 'user_blocked') {
            try {
                await set(ref(db, `users/${uid}/blockedByUsers/${senderUid}`), true);
                if (userProfile) {
                    if (!userProfile.blockedByUsers) userProfile.blockedByUsers = {};
                    userProfile.blockedByUsers[senderUid] = true;
                }
                if (activePersonalChatFriend?.uid === senderUid) {
                    checkBlockStatus(senderUid);
                }
                if (currentSectionId === 'messages-section') renderConversationsList(currentConversationsCache);
                if (currentSectionId === 'friends-section') renderFriendsList(currentFriendsCache);
            } catch (e) {}
            await consumeSignal();
        } else if (sig.type === 'user_unblocked') {
            try {
                await remove(ref(db, `users/${uid}/blockedByUsers/${senderUid}`));
                if (userProfile?.blockedByUsers) {
                    delete userProfile.blockedByUsers[senderUid];
                }
                if (activePersonalChatFriend?.uid === senderUid) {
                    checkBlockStatus(senderUid);
                }
                if (currentSectionId === 'messages-section') renderConversationsList(currentConversationsCache);
                if (currentSectionId === 'friends-section') renderFriendsList(currentFriendsCache);
            } catch (e) {}
            await consumeSignal();
        } else if (sig.type === 'friend_request_cancelled') {
            try {
                await set(ref(db, `users/${uid}/incomingRequests/${senderUid}`), { status: 'cancelled', senderUid, cancelledAt: Date.now() }).catch(() => {});
                await remove(ref(db, `users/${uid}/incomingRequests/${senderUid}`)).catch(() => {});
                await set(ref(db, `users/${uid}/sentFriendRequests/${senderUid}`), { status: 'cancelled', targetUid: senderUid, cancelledAt: Date.now() }).catch(() => {});
                await remove(ref(db, `users/${uid}/sentFriendRequests/${senderUid}`)).catch(() => {});
                if (currentInspectedUser?.uid === senderUid) {
                    updateProfileFriendActionButton(currentInspectedUser);
                }
                if (currentSectionId === 'friend-requests-section') loadFriendRequestsData();
            } catch (e) {}
            await consumeSignal();
        } else if (sig.type === 'messages_seen') {
            try {
                const seenAtTs = Number(sig.seenAt || sig.timestamp || Date.now());
                const convRef = ref(db, `users/${uid}/conversations/${senderUid}`);
                const convSnap = await get(convRef).catch(() => null);
                if (convSnap && convSnap.exists()) {
                    const cVal = convSnap.val();
                    if (cVal && cVal.lastMessageSenderUid === uid && cVal.lastMessageStatus !== 'read') {
                        await update(convRef, { lastMessageStatus: 'read' }).catch(() => {});
                    }
                }
                if (activePersonalChatFriend?.uid === senderUid) {
                    activeFriendLastReadTs = Math.max(activeFriendLastReadTs, seenAtTs);
                    markAllMyMessagesAsReadInUI(activeFriendLastReadTs);
                }
            } catch (e) {}
            await consumeSignal();
        } else if (sig.type === 'chat_cleared') {
            try {
                const clearTs = Number(sig.timestamp) || Date.now();
                await remove(ref(db, `users/${uid}/conversations/${senderUid}`)).catch(() => {});
                if (activePersonalChatFriend?.uid === senderUid) {
                    activeChatClearedAt = Math.max(activeChatClearedAt, clearTs);
                    renderEmptyPersonalChatPlaceholder(true);
                }
                if (currentSectionId === 'messages-section') loadConversationsData();
            } catch (e) {}
            await consumeSignal();
        } else if (sig.type === 'chat_message') {
            try {
                if (userProfile?.blockedUsers?.[senderUid] || userProfile?.blockedByUsers?.[senderUid]) {
                    await consumeSignal();
                    return;
                }
                const relSnap = await get(ref(db, `chats/rel_${pairId}`)).catch(() => null);
                const relVal = relSnap && relSnap.exists() ? relSnap.val() : null;
                const msgTs = Number(sig.timestamp) || Date.now();
                if (relVal) {
                    if (relVal.status === 'unfriended' || relVal[`blockedBy_${uid}`] || relVal[`blockedBy_${senderUid}`]) {
                        await consumeSignal();
                        return;
                    }
                    if (relVal.clearedAt && msgTs <= Number(relVal.clearedAt)) {
                        await consumeSignal();
                        return;
                    }
                }

                const isChatOpenWithSender = (activePersonalChatFriend?.uid === senderUid && elements.personalChatSection?.style.display === 'flex');
                if (sig.msgId) {
                    const msgNodeRef = ref(db, `chats/p2p_${pairId}/${sig.msgId}`);
                    if (isChatOpenWithSender) {
                        update(msgNodeRef, { delivered: true, read: true, seenAt: Date.now() }).catch(() => {});
                    } else {
                        update(msgNodeRef, { delivered: true }).catch(() => {});
                    }
                }

                const convNodeRef = ref(db, `users/${uid}/conversations/${senderUid}`);
                const convSnap = await get(convNodeRef).catch(() => null);
                const existingConv = (convSnap && convSnap.exists()) ? convSnap.val() : null;
                const prevUnread = (existingConv && typeof existingConv.unreadCount === 'number') ? existingConv.unreadCount : 0;
                const alreadyCounted = existingConv && ((sig.msgId && existingConv.lastUnreadMsgId === sig.msgId) || (existingConv.lastMessageTimestamp && existingConv.lastMessageTimestamp >= msgTs));

                const nextUnread = isChatOpenWithSender ? 0 : (alreadyCounted ? prevUnread : prevUnread + 1);
                await update(convNodeRef, {
                    friendUid: senderUid,
                    friendName: sig.senderName || existingConv?.friendName || 'Player',
                    friendPhoto: sig.senderPhoto || existingConv?.friendPhoto || '',
                    lastMessage: sig.text || '',
                    lastMessageTimestamp: msgTs,
                    lastMessageSenderUid: senderUid,
                    lastMessageStatus: isChatOpenWithSender ? 'read' : 'delivered',
                    lastUnreadMsgId: sig.msgId || `${senderUid}_${msgTs}`,
                    unreadCount: nextUnread,
                    ...(isChatOpenWithSender ? { lastReadTimestamp: Date.now() } : {})
                });

                if (!isChatOpenWithSender) {
                    const sTs = extractNotifTimestamp(sig);
                    if (sTs > appSessionStartTime || !sTs) {
                        triggerSystemNotification(`Message from ${sig.senderName || 'Player'}`, {
                            body: sig.text || 'Sent you a message',
                            icon: sig.senderPhoto || 'https://ui-avatars.com/api/?name=Win+Big&background=FACC15&color=0F172A&bold=true',
                            tag: `chat_msg_${senderUid}`
                        });
                    }
                }
            } catch (e) {}
            await consumeSignal();
        } else {
            await consumeSignal();
        }
    });
    dbListeners['signals'] = { ref: sigRef, eventType: 'child_added', func: sigFunc };

    // 4. Friends Listener (Friends Count Badge + Real-time Pair Relationship Listeners)
    const friendsRef = ref(db, `users/${uid}/friends`);
    const friendsFunc = onValue(friendsRef, (snap) => {
        let count = 0;
        const friendsList: any[] = [];
        if (snap.exists()) {
            snap.forEach((child) => {
                const val = child.val();
                if (val && typeof val === 'object') {
                    const fUid = val.friendUid || val.uid || child.key;
                    if (fUid) {
                        count++;
                        friendsList.push({
                            ...val,
                            friendUid: fUid
                        });
                    }
                }
            });
        }
        currentFriendsCache = friendsList;
        if (elements.friendsCountBadge) {
            elements.friendsCountBadge.textContent = String(count);
            elements.friendsCountBadge.style.display = count > 0 ? 'inline-block' : 'none';
        }
        syncFriendRelListeners(uid, friendsList);
        if (currentSectionId === 'friends-section') {
            renderFriendsList(friendsList);
        }
    });
    dbListeners['friends'] = { path: `users/${uid}/friends`, func: friendsFunc };

    // 5. Conversations Listener (Total Unread Messages Badge)
    const convRef = ref(db, `users/${uid}/conversations`);
    const convFunc = onValue(convRef, (snap) => {
        let totalUnread = 0;
        const convList: any[] = [];
        if (snap.exists()) {
            snap.forEach((child) => {
                const val = child.val();
                const cKey = child.key || '';
                if (val && typeof val === 'object') {
                    if (!val.lastMessage && !val.friendName) {
                        if (cKey) remove(ref(db, `users/${uid}/conversations/${cKey}`)).catch(() => {});
                        return;
                    }
                    const convItem = {
                        ...val,
                        friendUid: val.friendUid || cKey
                    };
                    if (!convItem.friendUid || !convItem.lastMessage) return;
                    convList.push(convItem);
                    if (typeof convItem.unreadCount === 'number' && convItem.unreadCount > 0) {
                        totalUnread += convItem.unreadCount;
                    }
                }
            });
        }
        convList.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
        currentConversationsCache = convList;
        if (elements.messagesUnreadBadge) {
            elements.messagesUnreadBadge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
            elements.messagesUnreadBadge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
        }
        if (currentSectionId === 'messages-section') {
            renderConversationsList(convList);
        }
    });
    dbListeners['userConversations'] = { path: `users/${uid}/conversations`, func: convFunc };

    // 6. User Notifications Live Listener (background & system push alerts)
    const seenUserKeys = new Set<string>();
    let initialUserLoaded = false;
    const notifRef = query(ref(db, `users/${uid}/notifications`), limitToLast(25));

    const notifFunc = onChildAdded(notifRef, (snap) => {
        const notif = snap.val();
        const key = snap.key || '';
        const ts = extractNotifTimestamp(notif);
        const alreadySeen = localStorage.getItem(`erena_sys_pushed_${key}`);
        const isCleared = Boolean(userProfile?.clearedNotificationIds && userProfile.clearedNotificationIds[key]);
        const isUnread = ts > (userProfile?.lastCheckedNotifications || 0);
        const isRecent = ts > (Date.now() - 30 * 60 * 1000);
        const isNewArrival = (initialUserLoaded && !seenUserKeys.has(key));

        if (notif && key && !alreadySeen && !isCleared && (isNewArrival || isRecent || isUnread)) {
            seenUserKeys.add(key);
            triggerSystemNotification(notif.title || 'Erena Esports', {
                body: notif.message || notif.body || notif.text || 'You have a new update in Erena Esports!',
                icon: notif.imageUrl || notif.icon,
                imageUrl: notif.imageUrl || notif.image,
                tag: `notif_${key}`
            }).then((shown) => {
                if (shown) {
                    try { localStorage.setItem(`erena_sys_pushed_${key}`, '1'); } catch (_) {}
                }
            }).catch(() => {});
        } else if (key) {
            seenUserKeys.add(key);
        }
        loadAndDisplayNotifications();
    });
    get(notifRef).then((snap) => {
        if (snap.exists()) {
            snap.forEach((c) => { if (c.key) seenUserKeys.add(c.key); });
        }
        initialUserLoaded = true;
    }).catch(() => { initialUserLoaded = true; });
    dbListeners['userNotifications'] = { ref: notifRef, eventType: 'child_added', func: notifFunc };

    // Global Notifications Live Listener
    const seenGlobalKeys = new Set<string>();
    let initialGlobalLoaded = false;
    const globalNotifRef = query(ref(db, 'notifications'), limitToLast(25));

    const globalNotifFunc = onChildAdded(globalNotifRef, (snap) => {
        const notif = snap.val();
        const key = snap.key || '';
        const ts = extractNotifTimestamp(notif);
        const alreadySeen = localStorage.getItem(`erena_global_sys_pushed_${key}`);
        const isCleared = Boolean(userProfile?.clearedNotificationIds && userProfile.clearedNotificationIds[key]) ||
                          (ts > 0 && userProfile?.clearedNotificationsAt && ts <= userProfile.clearedNotificationsAt);
        const isUnread = ts > (userProfile?.lastCheckedNotifications || 0);
        const isRecent = ts > (Date.now() - 30 * 60 * 1000);
        const isNewArrival = (initialGlobalLoaded && !seenGlobalKeys.has(key));

        if (notif && key && !alreadySeen && !isCleared && (isNewArrival || isRecent || isUnread)) {
            seenGlobalKeys.add(key);
            triggerSystemNotification(notif.title || 'Erena Esports', {
                body: notif.message || notif.body || notif.text || 'New tournament update available in Erena Esports!',
                icon: notif.imageUrl || notif.icon,
                imageUrl: notif.imageUrl || notif.image,
                tag: `global_${key}`,
                skipFcmPush: true
            }).then((shown) => {
                if (shown) {
                    try { localStorage.setItem(`erena_global_sys_pushed_${key}`, '1'); } catch (_) {}
                }
            }).catch(() => {});
            dispatchGlobalNotificationFcm(key, notif).catch(() => {});
        } else if (key) {
            seenGlobalKeys.add(key);
        }
        loadAndDisplayNotifications();
    });
    get(globalNotifRef).then((snap) => {
        if (snap.exists()) {
            snap.forEach((c) => { if (c.key) seenGlobalKeys.add(c.key); });
        }
        initialGlobalLoaded = true;
    }).catch(() => { initialGlobalLoaded = true; });
    dbListeners['globalNotifications'] = { ref: globalNotifRef, eventType: 'child_added', func: globalNotifFunc };

    // 7. Transactions Live Listener (Auto reconcile when admin sends money)
    const transLiveRef = ref(db, `transactions/${uid}`);
    const transLiveFunc = onValue(transLiveRef, () => {
        reconcileTransactions(uid);
        syncRedemptionsWithAdminNotes(uid);
        if (currentSectionId === 'wallet-section') {
            loadRecentTransactions();
        }
    });
    dbListeners['userTransactions'] = { path: `transactions/${uid}`, func: transLiveFunc };

    // 8. Withdrawals Live Listener (Sync redeem code notes & withdrawal status in real-time)
    const userWithdrawalsLiveRef = query(ref(db, 'withdrawals'), orderByChild('userId'), equalTo(uid));
    const userWithdrawalsLiveFunc = onValue(userWithdrawalsLiveRef, () => {
        syncRedemptionsWithAdminNotes(uid);
        if (currentSectionId === 'wallet-section') {
            loadRecentTransactions();
        }
    }, () => {});
    dbListeners['userWithdrawalsLive'] = { ref: userWithdrawalsLiveRef, func: userWithdrawalsLiveFunc };

    // 9. Deposits Live Listener (Sync deposit approval/rejection status in real-time)
    const userDepositsLiveRef = query(ref(db, 'deposits'), orderByChild('userId'), equalTo(uid));
    const userDepositsLiveFunc = onValue(userDepositsLiveRef, () => {
        if (currentSectionId === 'wallet-section') {
            loadRecentTransactions();
        }
    }, () => {});
    dbListeners['userDepositsLive'] = { ref: userDepositsLiveRef, func: userDepositsLiveFunc };
}

function detachAllDbListeners() {
    redemptionsListenerInitialized = false;
    for (const k in dbListeners) {
        try {
            const item = dbListeners[k];
            if (item.ref && item.func) {
                off(item.ref, item.eventType || 'value', item.func);
            } else if (item.path && item.func) {
                off(ref(db, item.path), item.eventType || 'value', item.func);
            }
        } catch (e) {}
    }
    dbListeners = {};
    for (const fUid in friendRelListeners) {
        try {
            const item = friendRelListeners[fUid];
            off(ref(db, item.path), 'value', item.func);
        } catch (e) {}
    }
    friendRelListeners = {};
}

function syncFriendRelListeners(myUid: string, friendsList: any[]) {
    const activeFriendSet = new Set<string>();
    friendsList.forEach(f => {
        const fUid = f.friendUid || f.uid;
        if (fUid && fUid !== myUid) activeFriendSet.add(fUid);
    });

    for (const fUid in friendRelListeners) {
        if (!activeFriendSet.has(fUid)) {
            try {
                off(ref(db, friendRelListeners[fUid].path), 'value', friendRelListeners[fUid].func);
            } catch (e) {}
            delete friendRelListeners[fUid];
        }
    }

    activeFriendSet.forEach(fUid => {
        if (friendRelListeners[fUid]) return;
        const pairId = getChatPairId(myUid, fUid);
        const relPath = `chats/rel_${pairId}`;
        const func = onValue(ref(db, relPath), async (snap) => {
            if (!currentUser || currentUser.uid !== myUid || !snap.exists()) return;
            const rel = snap.val();
            if (!rel || typeof rel !== 'object') return;

            // 1. Real-time Unfriend sync
            if (rel.status === 'unfriended') {
                await set(ref(db, `users/${myUid}/removedFriends/${fUid}`), Number(rel.unfriendedAt) || Date.now()).catch(() => {});
                await remove(ref(db, `users/${myUid}/friends/${fUid}`)).catch(() => {});
                await remove(ref(db, `users/${myUid}/conversations/${fUid}`)).catch(() => {});
                await remove(ref(db, `users/${myUid}/incomingRequests/${fUid}`)).catch(() => {});
                await remove(ref(db, `users/${myUid}/sentFriendRequests/${fUid}`)).catch(() => {});
                if (activePersonalChatFriend?.uid === fUid) {
                    closePersonalChat();
                }
                if (currentInspectedUser?.uid === fUid) {
                    updateProfileFriendActionButton(currentInspectedUser);
                }
                if (currentSectionId === 'friends-section') loadFriendsData();
                if (currentSectionId === 'messages-section') loadConversationsData();
                return;
            }

            // 2. Real-time Block / Unblock sync from the other user
            const blockedByThem = Boolean(rel[`blockedBy_${fUid}`]);
            const prevBlockedByThem = Boolean(userProfile?.blockedByUsers?.[fUid]);
            if (blockedByThem !== prevBlockedByThem) {
                if (blockedByThem) {
                    if (userProfile) {
                        if (!userProfile.blockedByUsers) userProfile.blockedByUsers = {};
                        userProfile.blockedByUsers[fUid] = true;
                    }
                    set(ref(db, `users/${myUid}/blockedByUsers/${fUid}`), true).catch(() => {});
                } else {
                    if (userProfile?.blockedByUsers) {
                        delete userProfile.blockedByUsers[fUid];
                    }
                    remove(ref(db, `users/${myUid}/blockedByUsers/${fUid}`)).catch(() => {});
                }
                if (activePersonalChatFriend?.uid === fUid) {
                    checkBlockStatus(fUid);
                }
                if (currentInspectedUser?.uid === fUid) {
                    updateProfileFriendActionButton(currentInspectedUser);
                }
                if (currentSectionId === 'messages-section') renderConversationsList(currentConversationsCache);
                if (currentSectionId === 'friends-section') renderFriendsList(currentFriendsCache);
            }

            // 3. Real-time Read Receipt (Double Blue Tick) sync in conversation list & chat
            const theirReadTs = Number(rel[`lastRead_${fUid}`] || 0);
            if (theirReadTs > 0) {
                const convItem = currentConversationsCache.find(c => c.friendUid === fUid);
                if (convItem && convItem.lastMessageSenderUid === myUid && convItem.lastMessageStatus !== 'read' && theirReadTs >= Number(convItem.lastMessageTimestamp || 0)) {
                    update(ref(db, `users/${myUid}/conversations/${fUid}`), { lastMessageStatus: 'read' }).catch(() => {});
                }
                if (activePersonalChatFriend?.uid === fUid) {
                    activeFriendLastReadTs = Math.max(activeFriendLastReadTs, theirReadTs);
                    markAllMyMessagesAsReadInUI(activeFriendLastReadTs);
                }
            }

            // 4. Real-time Clear Chat sync
            const clearedAt = Number(rel.clearedAt || 0);
            if (clearedAt > 0) {
                const convItem = currentConversationsCache.find(c => c.friendUid === fUid);
                if (convItem && Number(convItem.lastMessageTimestamp || 0) <= clearedAt) {
                    remove(ref(db, `users/${myUid}/conversations/${fUid}`)).catch(() => {});
                }
                if (activePersonalChatFriend?.uid === fUid && clearedAt > activeChatClearedAt) {
                    activeChatClearedAt = clearedAt;
                    renderEmptyPersonalChatPlaceholder(true);
                }
            }
        });
        friendRelListeners[fUid] = { path: relPath, func };
    });
}

/* =========================================================
   FRIEND SYSTEM & PERSONAL CHAT IMPLEMENTATION
   ========================================================= */

const formatMessageTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const recentlyCancelledFriendRequests: Record<string, number> = {};

// 1. Update Friend Action Buttons on User Profile
async function updateProfileFriendActionButton(targetUser: any, preserveAlert = false) {
    const container = elements.lbModalFriendActionContainer;
    const alertEl = elements.lbModalFriendStatusAlert;
    if (!container) return;
    if (alertEl && !preserveAlert) alertEl.style.display = 'none';

    container.innerHTML = `<div class="spinner-border spinner-border-sm text-warning"></div>`;

    if (!currentUser) {
        container.innerHTML = `<button class="btn btn-sm btn-outline-warning rounded-pill px-3" onclick="showSection('login-section')"><i class="bi bi-box-arrow-in-right me-1"></i> Login to Add Friend</button>`;
        return;
    }

    const targetUid = targetUser.uid;
    if (!targetUid || targetUid === currentUser.uid) {
        container.innerHTML = `<span class="badge bg-secondary py-2 px-3 rounded-pill"><i class="bi bi-person-check-fill me-1"></i> Your Profile</span>`;
        return;
    }

    try {
        const pairId = getChatPairId(currentUser.uid, targetUid);
        const [friendSnap, relSnap, removedSnap, recFriendSnap, outgoingSnap, incomingSnap, localIncomingSnap, theirRejectedSnap, myRejectedSnap] = await Promise.all([
            get(ref(db, `users/${currentUser.uid}/friends/${targetUid}`)).catch(() => null),
            get(ref(db, `chats/rel_${pairId}`)).catch(() => null),
            get(ref(db, `users/${currentUser.uid}/removedFriends/${targetUid}`)).catch(() => null),
            get(ref(db, `users/${targetUid}/friends/${currentUser.uid}`)).catch(() => null),
            get(ref(db, `users/${currentUser.uid}/sentFriendRequests/${targetUid}`)).catch(() => null),
            get(ref(db, `users/${targetUid}/sentFriendRequests/${currentUser.uid}`)).catch(() => null),
            get(ref(db, `users/${currentUser.uid}/incomingRequests/${targetUid}`)).catch(() => null),
            get(ref(db, `users/${targetUid}/rejectedRequests/${currentUser.uid}`)).catch(() => null),
            get(ref(db, `users/${currentUser.uid}/rejectedRequests/${targetUid}`)).catch(() => null)
        ]);

        const relVal = (relSnap && relSnap.exists()) ? relSnap.val() : null;
        const relStatus = relVal?.status || null;

        // If unfriended in shared relationship state, clean up any stale local friend record so they must re-request
        if (relStatus === 'unfriended') {
            if (friendSnap && friendSnap.exists()) {
                await remove(ref(db, `users/${currentUser.uid}/friends/${targetUid}`)).catch(() => {});
                await remove(ref(db, `users/${currentUser.uid}/conversations/${targetUid}`)).catch(() => {});
            }
        }

        const isConfirmedFriend = (relStatus === 'friends') || (friendSnap && friendSnap.exists() && relStatus !== 'unfriended' && relStatus !== 'pending' && relStatus !== 'cancelled' && relStatus !== 'rejected');

        // 1. If confirmed friends
        if (isConfirmedFriend) {
            if (!friendSnap || !friendSnap.exists()) {
                const tName = targetUser.displayName || 'Player';
                const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(tName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;
                const tPhoto = resolveUserAvatarUrl(targetUser, defaultPhoto);
                await set(ref(db, `users/${currentUser.uid}/friends/${targetUid}`), {
                    friendUid: targetUid,
                    displayName: tName,
                    photoURL: tPhoto,
                    addedAt: Date.now()
                }).catch(() => {});
                await remove(ref(db, `users/${currentUser.uid}/removedFriends/${targetUid}`)).catch(() => {});
                await set(ref(db, `users/${currentUser.uid}/sentFriendRequests/${targetUid}`), { status: 'accepted', targetUid }).catch(() => {});
                await remove(ref(db, `users/${currentUser.uid}/sentFriendRequests/${targetUid}`)).catch(() => {});
                await set(ref(db, `users/${currentUser.uid}/incomingRequests/${targetUid}`), { status: 'accepted', senderUid: targetUid }).catch(() => {});
                await remove(ref(db, `users/${currentUser.uid}/incomingRequests/${targetUid}`)).catch(() => {});
            }
            container.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-success py-2 px-3 rounded-pill d-inline-flex align-items-center gap-1">
                        <i class="bi bi-people-fill"></i> Friends
                    </span>
                    <button class="btn btn-sm btn-primary fw-bold px-3 py-2 rounded-pill d-inline-flex align-items-center gap-1 shadow-sm" id="lbModalMessageFriendBtn">
                        <i class="bi bi-chat-dots-fill"></i> Message
                    </button>
                </div>
            `;
            const msgBtn = document.getElementById('lbModalMessageFriendBtn');
            if (msgBtn) {
                msgBtn.onclick = () => {
                    openPersonalChat(targetUser, {
                        type: 'modal',
                        modalId: 'leaderboardUserProfileModalEl',
                        inspectedUser: targetUser
                    });
                };
            }
            return;
        }

        // 1b. Check legacy reciprocal friend ONLY if not unfriended
        if (recFriendSnap && recFriendSnap.exists() && (!removedSnap || !removedSnap.exists()) && !relStatus) {
            const tName = targetUser.displayName || 'Player';
            const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(tName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;
            const tPhoto = resolveUserAvatarUrl(targetUser, defaultPhoto);
            await set(ref(db, `users/${currentUser.uid}/friends/${targetUid}`), {
                friendUid: targetUid,
                displayName: tName,
                photoURL: tPhoto,
                addedAt: Date.now()
            });
            await update(ref(db, `chats/rel_${pairId}`), {
                status: 'friends',
                acceptedAt: Date.now()
            }).catch(() => {});
            await set(ref(db, `users/${currentUser.uid}/sentFriendRequests/${targetUid}`), { status: 'accepted', targetUid }).catch(() => {});
            await remove(ref(db, `users/${currentUser.uid}/sentFriendRequests/${targetUid}`)).catch(() => {});
            updateProfileFriendActionButton(targetUser, preserveAlert);
            return;
        }

        // 2. Check if outgoing request is pending (authoritative on currentUser's sentFriendRequests)
        const outgoingVal = (outgoingSnap && outgoingSnap.exists()) ? outgoingSnap.val() : null;
        const outgoingTs = Number(outgoingVal?.timestamp || 0);
        const theirRejectedTs = Number((theirRejectedSnap && theirRejectedSnap.exists()) ? theirRejectedSnap.val() : 0);
        const relRejectedTs = (relStatus === 'rejected' && relVal?.rejectedBy === targetUid) ? Number(relVal?.rejectedAt || 0) : 0;
        const wasRejectedByTarget = (theirRejectedTs > 0 && theirRejectedTs >= outgoingTs) || (relRejectedTs > 0 && relRejectedTs >= outgoingTs);
        const cancelledLocalTs = Number(recentlyCancelledFriendRequests[targetUid] || 0);
        const isCancelledLocally = cancelledLocalTs > 0 && cancelledLocalTs >= outgoingTs;

        const hasOutgoingPending = Boolean(
            outgoingVal &&
            typeof outgoingVal === 'object' &&
            outgoingVal.status !== 'cancelled' &&
            outgoingVal.status !== 'rejected' &&
            outgoingVal.status !== 'accepted' &&
            !wasRejectedByTarget &&
            !isCancelledLocally
        );

        if (hasOutgoingPending) {
            container.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-secondary fw-bold px-3 py-2 rounded-pill" disabled>
                        <i class="bi bi-clock-history me-1"></i> Request Sent
                    </button>
                    <button class="btn btn-sm btn-outline-danger px-2 py-1 rounded-pill" id="lbModalCancelRequestBtn" title="Cancel Request">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
            `;
            const cancelBtn = document.getElementById('lbModalCancelRequestBtn') as HTMLButtonElement | null;
            if (cancelBtn) {
                cancelBtn.onclick = async () => {
                    cancelBtn.disabled = true;
                    cancelBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                    await cancelFriendRequest(targetUid);
                    await updateProfileFriendActionButton(targetUser, true);
                };
            }
            return;
        } else if (outgoingVal && outgoingVal.status !== 'cancelled') {
            await set(ref(db, `users/${currentUser.uid}/sentFriendRequests/${targetUid}`), {
                targetUid,
                senderUid: currentUser.uid,
                status: 'cancelled',
                cancelledAt: Date.now()
            }).catch(() => {});
            await remove(ref(db, `users/${currentUser.uid}/sentFriendRequests/${targetUid}`)).catch(() => {});
        }

        // 3. Check if incoming request is pending (authoritative on targetUser's sentFriendRequests)
        const incomingVal = (incomingSnap && incomingSnap.exists()) ? incomingSnap.val() : null;
        const incomingTs = Number(incomingVal?.timestamp || 0);
        const myRejectedTs = Number((myRejectedSnap && myRejectedSnap.exists()) ? myRejectedSnap.val() : 0);
        const wasRejectedByMe = myRejectedTs > 0 && myRejectedTs >= incomingTs;

        const hasIncomingPending = Boolean(
            incomingVal &&
            typeof incomingVal === 'object' &&
            incomingVal.status !== 'cancelled' &&
            incomingVal.status !== 'rejected' &&
            incomingVal.status !== 'accepted' &&
            !wasRejectedByMe
        );

        if (hasIncomingPending) {
            container.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-success fw-bold px-3 py-2 rounded-pill d-inline-flex align-items-center gap-1" id="lbModalAcceptIncomingBtn">
                        <i class="bi bi-check-lg"></i> Accept
                    </button>
                    <button class="btn btn-sm btn-outline-danger px-3 py-2 rounded-pill d-inline-flex align-items-center gap-1" id="lbModalRejectIncomingBtn">
                        <i class="bi bi-x-lg"></i> Reject
                    </button>
                </div>
            `;
            const acceptBtn = document.getElementById('lbModalAcceptIncomingBtn') as HTMLButtonElement | null;
            const rejectBtn = document.getElementById('lbModalRejectIncomingBtn') as HTMLButtonElement | null;
            if (acceptBtn) {
                acceptBtn.onclick = async () => {
                    acceptBtn.disabled = true;
                    await acceptFriendRequest(targetUid, targetUser.displayName, resolveUserAvatarUrl(targetUser, targetUser.photoURL));
                    await updateProfileFriendActionButton(targetUser, true);
                };
            }
            if (rejectBtn) {
                rejectBtn.onclick = async () => {
                    rejectBtn.disabled = true;
                    await rejectFriendRequest(targetUid);
                    await updateProfileFriendActionButton(targetUser, true);
                };
            }
            return;
        } else if (localIncomingSnap && localIncomingSnap.exists() && localIncomingSnap.val()?.status !== 'cancelled') {
            await set(ref(db, `users/${currentUser.uid}/incomingRequests/${targetUid}`), {
                senderUid: targetUid,
                status: 'cancelled',
                cancelledAt: Date.now()
            }).catch(() => {});
            await remove(ref(db, `users/${currentUser.uid}/incomingRequests/${targetUid}`)).catch(() => {});
        }

        // 4. Default: User can add friend (Styled with same-to-same golden pill button)
        container.innerHTML = `
            <button class="ff-gold-action-pill-btn" id="lbModalAddFriendBtn">
                <i class="bi bi-person-plus-fill"></i> + Add Friend
            </button>
        `;
        const addBtn = document.getElementById('lbModalAddFriendBtn') as HTMLButtonElement | null;
        if (addBtn) {
            addBtn.onclick = async () => {
                addBtn.disabled = true;
                addBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Sending...';
                await sendFriendRequest(targetUser);
                await updateProfileFriendActionButton(targetUser, true);
            };
        }
    } catch (e) {
        console.error("Error checking friendship:", e);
        container.innerHTML = `<span class="small text-secondary">Unable to check status</span>`;
    }
}

// 2. Send Friend Request
async function sendFriendRequest(targetUser: any) {
    if (!currentUser) {
        alert("Please login to send friend request.");
        showSection('login-section');
        return;
    }
    const targetUid = targetUser.uid;
    if (!targetUid || targetUid === currentUser.uid) {
        alert("You cannot send a friend request to yourself.");
        return;
    }

    try {
        const isBlocked = await checkIsBlocked(currentUser.uid, targetUid);
        if (isBlocked) {
            alert("Cannot send friend request due to block settings.");
            return;
        }

        const pairId = getChatPairId(currentUser.uid, targetUid);
        const [relSnap, existingSnap, friendSnap, theirRejectedSnap] = await Promise.all([
            get(ref(db, `chats/rel_${pairId}`)).catch(() => null),
            get(ref(db, `users/${currentUser.uid}/sentFriendRequests/${targetUid}`)).catch(() => null),
            get(ref(db, `users/${currentUser.uid}/friends/${targetUid}`)).catch(() => null),
            get(ref(db, `users/${targetUid}/rejectedRequests/${currentUser.uid}`)).catch(() => null)
        ]);
        const relVal = (relSnap && relSnap.exists()) ? relSnap.val() : null;

        // If previously unfriended, clean up stale local records so new request can proceed cleanly
        if (relVal && relVal.status === 'unfriended') {
            await remove(ref(db, `users/${currentUser.uid}/friends/${targetUid}`)).catch(() => {});
        }

        const existingVal = (existingSnap && existingSnap.exists()) ? existingSnap.val() : null;
        const existingTs = Number(existingVal?.timestamp || 0);
        const theirRejectedTs = Number((theirRejectedSnap && theirRejectedSnap.exists()) ? theirRejectedSnap.val() : 0);
        const wasRejected = theirRejectedTs > 0 && theirRejectedTs >= existingTs;
        const cancelledLocalTs = Number(recentlyCancelledFriendRequests[targetUid] || 0);
        const isCancelledLocally = cancelledLocalTs > 0 && cancelledLocalTs >= existingTs;

        if (existingVal && typeof existingVal === 'object' && existingVal.status === 'pending' && !wasRejected && !isCancelledLocally) {
            alert("Friend request has already been sent to this user.");
            return;
        }
        if (friendSnap && friendSnap.exists() && relVal?.status !== 'unfriended') {
            alert("You are already friends with this player!");
            return;
        }

        const nowTs = Date.now();
        delete recentlyCancelledFriendRequests[targetUid];

        const senderName = userProfile.displayName || currentUser.email?.split('@')[0] || 'Player';
        const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;
        const senderPhoto = resolveUserAvatarUrl(userProfile, defaultPhoto);

        const reqPayload = {
            senderUid: currentUser.uid,
            senderName,
            senderPhoto,
            senderEmail: currentUser.email || '',
            targetUid,
            timestamp: nowTs,
            status: 'pending'
        };

        if (userProfile) {
            if (!userProfile.sentFriendRequests) userProfile.sentFriendRequests = {};
            userProfile.sentFriendRequests[targetUid] = reqPayload;
        }

        await remove(ref(db, `users/${currentUser.uid}/removedFriends/${targetUid}`)).catch(() => {});
        await remove(ref(db, `users/${currentUser.uid}/rejectedRequests/${targetUid}`)).catch(() => {});
        await set(ref(db, `users/${currentUser.uid}/sentFriendRequests/${targetUid}`), reqPayload);

        await update(ref(db, `chats/rel_${pairId}`), {
            status: 'pending',
            requesterUid: currentUser.uid,
            requesterName: senderName,
            requesterPhoto: senderPhoto,
            targetUid,
            requestedAt: nowTs,
            cancelledAt: null,
            rejectedAt: null
        }).catch(() => {});

        // Send real-time notification signal to target user via chats/sig_${targetUid}
        await push(ref(db, `chats/sig_${targetUid}`), {
            type: 'friend_request',
            senderUid: currentUser.uid,
            senderName,
            senderPhoto,
            timestamp: nowTs
        }).catch(() => {});

        if (elements.lbModalFriendStatusAlert) {
            elements.lbModalFriendStatusAlert.className = 'alert alert-success small py-1 px-3 mb-2 text-center';
            elements.lbModalFriendStatusAlert.textContent = 'Friend request sent successfully!';
            elements.lbModalFriendStatusAlert.style.display = 'block';
        }
    } catch (e: any) {
        console.error("Failed to send friend request:", e);
        alert("Could not send friend request. Please try again.");
    }
}

// 3. Cancel Friend Request
async function cancelFriendRequest(targetUid: string) {
    if (!currentUser || !targetUid) return;
    try {
        const nowTs = Date.now();
        recentlyCancelledFriendRequests[targetUid] = nowTs;

        if (userProfile?.sentFriendRequests) {
            delete userProfile.sentFriendRequests[targetUid];
        }

        const pairId = getChatPairId(currentUser.uid, targetUid);

        // First mark status as 'cancelled' (guaranteed to succeed even if DB rules require newData.exists()), then remove
        await set(ref(db, `users/${currentUser.uid}/sentFriendRequests/${targetUid}`), {
            senderUid: currentUser.uid,
            targetUid,
            status: 'cancelled',
            cancelledAt: nowTs,
            timestamp: nowTs
        }).catch(() => {});
        await remove(ref(db, `users/${currentUser.uid}/sentFriendRequests/${targetUid}`)).catch(() => {});

        await update(ref(db, `chats/rel_${pairId}`), {
            status: 'cancelled',
            requesterUid: null,
            cancelledBy: currentUser.uid,
            cancelledAt: nowTs
        }).catch(() => {});

        await push(ref(db, `chats/sig_${targetUid}`), {
            type: 'friend_request_cancelled',
            senderUid: currentUser.uid,
            timestamp: nowTs
        }).catch(() => {});

        if (elements.lbModalFriendStatusAlert) {
            elements.lbModalFriendStatusAlert.className = 'alert alert-info small py-1 px-3 mb-2 text-center';
            elements.lbModalFriendStatusAlert.textContent = 'Friend request cancelled.';
            elements.lbModalFriendStatusAlert.style.display = 'block';
        }
    } catch (e) {
        console.error("Cancel request failed", e);
    }
}

// 4. Accept Friend Request
async function acceptFriendRequest(senderUid: string, senderNameParam?: string, senderPhotoParam?: string) {
    if (!currentUser) return;
    try {
        let senderName = senderNameParam;
        let senderPhoto = senderPhotoParam;
        const senderSnap = await get(ref(db, `users/${senderUid}`)).catch(() => null);
        if (senderSnap && senderSnap.exists()) {
            const sVal = senderSnap.val();
            senderName = sVal.displayName || senderName || sVal.email?.split('@')[0] || 'Player';
            const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName || 'Player')}&background=0F172A&color=E2E8F0&bold=true&size=50`;
            senderPhoto = resolveUserAvatarUrl(sVal, senderPhoto || defaultPhoto);
        }
        senderName = senderName || 'Player';
        senderPhoto = senderPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;

        const myName = userProfile.displayName || currentUser.email?.split('@')[0] || 'Player';
        const myDefaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(myName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;
        const myPhoto = resolveUserAvatarUrl(userProfile, myDefaultPhoto);
        const nowTs = Date.now();
        const pairId = getChatPairId(currentUser.uid, senderUid);

        // Store friendship in current user's profile
        await remove(ref(db, `users/${currentUser.uid}/removedFriends/${senderUid}`)).catch(() => {});
        await remove(ref(db, `users/${currentUser.uid}/rejectedRequests/${senderUid}`)).catch(() => {});
        await set(ref(db, `users/${currentUser.uid}/friends/${senderUid}`), {
            friendUid: senderUid,
            displayName: senderName,
            photoURL: senderPhoto,
            addedAt: nowTs
        });

        // Clean up requests in current user's profile
        await set(ref(db, `users/${currentUser.uid}/incomingRequests/${senderUid}`), { status: 'accepted', senderUid }).catch(() => {});
        await remove(ref(db, `users/${currentUser.uid}/incomingRequests/${senderUid}`)).catch(() => {});
        await set(ref(db, `users/${currentUser.uid}/sentFriendRequests/${senderUid}`), { status: 'accepted', targetUid: senderUid }).catch(() => {});
        await remove(ref(db, `users/${currentUser.uid}/sentFriendRequests/${senderUid}`)).catch(() => {});

        // Update shared relationship status so both users immediately recognize friendship
        await update(ref(db, `chats/rel_${pairId}`), {
            status: 'friends',
            acceptedAt: nowTs,
            acceptedBy: currentUser.uid,
            unfriendedBy: null,
            unfriendedAt: null
        }).catch(() => {});

        // Notify sender via chats/sig_${senderUid}
        await push(ref(db, `chats/sig_${senderUid}`), {
            type: 'friend_accepted',
            senderUid: currentUser.uid,
            senderName: myName,
            senderPhoto: myPhoto,
            timestamp: nowTs
        }).catch(() => {});

        if (currentSectionId === 'friend-requests-section') loadFriendRequestsData();
        if (currentSectionId === 'friends-section') loadFriendsData();
    } catch (e: any) {
        console.error("Accept friend request failed:", e);
        alert("Failed to accept friend request.");
    }
}

// 5. Reject Friend Request
async function rejectFriendRequest(senderUid: string) {
    if (!currentUser) return;
    try {
        const nowTs = Date.now();
        const pairId = getChatPairId(currentUser.uid, senderUid);
        await set(ref(db, `users/${currentUser.uid}/incomingRequests/${senderUid}`), { status: 'rejected', senderUid, rejectedAt: nowTs }).catch(() => {});
        await remove(ref(db, `users/${currentUser.uid}/incomingRequests/${senderUid}`)).catch(() => {});
        await set(ref(db, `users/${currentUser.uid}/rejectedRequests/${senderUid}`), nowTs).catch(() => {});
        await update(ref(db, `chats/rel_${pairId}`), {
            status: 'rejected',
            requesterUid: null,
            rejectedBy: currentUser.uid,
            rejectedAt: nowTs
        }).catch(() => {});
        await push(ref(db, `chats/sig_${senderUid}`), {
            type: 'friend_request_cancelled',
            senderUid: currentUser.uid,
            timestamp: nowTs
        }).catch(() => {});
        if (currentSectionId === 'friend-requests-section') loadFriendRequestsData();
    } catch (e: any) {
        console.error("Reject friend request failed:", e);
        alert("Failed to reject friend request.");
    }
}

// 6. Remove Friend (Unfriend)
async function removeFriend(friendUid: string) {
    if (!currentUser || !friendUid) return;
    try {
        const cardEl = document.getElementById(`friend-card-${friendUid}`);
        if (cardEl) {
            cardEl.style.opacity = '0.5';
            cardEl.style.pointerEvents = 'none';
        }
        const convCardEl = document.getElementById(`conv-card-${friendUid}`);
        if (convCardEl) {
            convCardEl.style.opacity = '0.5';
            convCardEl.style.pointerEvents = 'none';
        }

        const nowTs = Date.now();
        const pairId = getChatPairId(currentUser.uid, friendUid);

        // Update shared relationship status so both users know they are unfriended (even if offline)
        await update(ref(db, `chats/rel_${pairId}`), {
            status: 'unfriended',
            unfriendedBy: currentUser.uid,
            unfriendedAt: nowTs,
            requesterUid: null
        }).catch(() => {});

        await set(ref(db, `users/${currentUser.uid}/removedFriends/${friendUid}`), nowTs).catch(() => {});
        await remove(ref(db, `users/${currentUser.uid}/friends/${friendUid}`)).catch(() => {});
        await set(ref(db, `users/${currentUser.uid}/incomingRequests/${friendUid}`), { status: 'cancelled', senderUid: friendUid }).catch(() => {});
        await remove(ref(db, `users/${currentUser.uid}/incomingRequests/${friendUid}`)).catch(() => {});
        await set(ref(db, `users/${currentUser.uid}/sentFriendRequests/${friendUid}`), { status: 'cancelled', targetUid: friendUid }).catch(() => {});
        await remove(ref(db, `users/${currentUser.uid}/sentFriendRequests/${friendUid}`)).catch(() => {});
        await remove(ref(db, `users/${currentUser.uid}/conversations/${friendUid}`)).catch(() => {});

        push(ref(db, `chats/sig_${friendUid}`), {
            type: 'friend_removed',
            senderUid: currentUser.uid,
            timestamp: nowTs
        }).catch(() => {});

        if (cardEl) cardEl.remove();
        if (convCardEl) convCardEl.remove();

        currentFriendsCache = currentFriendsCache.filter(f => (f.friendUid || f.uid) !== friendUid);
        currentConversationsCache = currentConversationsCache.filter(c => c.friendUid !== friendUid);

        if (elements.friendsCountBadge) {
            elements.friendsCountBadge.textContent = String(currentFriendsCache.length);
            elements.friendsCountBadge.style.display = currentFriendsCache.length > 0 ? 'inline-block' : 'none';
        }

        if (activePersonalChatFriend?.uid === friendUid) {
            closePersonalChat();
        }
        if (currentInspectedUser && (currentInspectedUser.uid === friendUid)) {
            updateProfileFriendActionButton(currentInspectedUser);
        }
        if (currentSectionId === 'friends-section') loadFriendsData();
        if (currentSectionId === 'messages-section') loadConversationsData();
    } catch (e) {
        console.error("Failed to remove friend:", e);
    }
}

// 7. Load Friend Requests Data
async function loadFriendRequestsData() {
    if (!currentUser) return;
    const listEl = elements.friendRequestsListContainerEl;
    const emptyEl = elements.noFriendRequestsMessageEl;
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-warning"></div></div>';
    if (emptyEl) emptyEl.style.display = 'none';

    try {
        const uid = currentUser.uid;
        // 1. Read existing saved incoming requests from users/${uid}/incomingRequests
        const incSnap = await get(ref(db, `users/${uid}/incomingRequests`));
        const requestsMap = new Map<string, any>();
        if (incSnap.exists()) {
            incSnap.forEach((child) => {
                const val = child.val();
                if (val && typeof val === 'object' && val.status !== 'cancelled' && val.status !== 'rejected' && val.status !== 'accepted') {
                    requestsMap.set(child.key as string, val);
                }
            });
        }

        // 2. Also check recent signals under chats/sig_${uid}
        try {
            const sigSnap = await get(query(ref(db, `chats/sig_${uid}`), limitToLast(40)));
            if (sigSnap.exists()) {
                const signals = sigSnap.val();
                for (const k of Object.keys(signals)) {
                    const sig = signals[k];
                    if (sig && sig.type === 'friend_request' && sig.senderUid && sig.senderUid !== uid) {
                        const sUid = sig.senderUid;
                        const pairId = getChatPairId(uid, sUid);
                        const [senderReqSnap, myFriendSnap, relSnap] = await Promise.all([
                            get(ref(db, `users/${sUid}/sentFriendRequests/${uid}`)).catch(() => null),
                            get(ref(db, `users/${uid}/friends/${sUid}`)).catch(() => null),
                            get(ref(db, `chats/rel_${pairId}`)).catch(() => null)
                        ]);
                        const relVal = (relSnap && relSnap.exists()) ? relSnap.val() : null;
                        const senderReqVal = (senderReqSnap && senderReqSnap.exists()) ? senderReqSnap.val() : null;
                        const isSenderPending = Boolean(senderReqVal && typeof senderReqVal === 'object' && senderReqVal.status !== 'cancelled' && senderReqVal.status !== 'rejected' && senderReqVal.status !== 'accepted');
                        const isAlreadyFriends = (myFriendSnap && myFriendSnap.exists() && relVal?.status !== 'unfriended') || (relVal && relVal.status === 'friends');
                        if (isSenderPending && !isAlreadyFriends) {
                            const senderUserSnap = await get(ref(db, `users/${sUid}`)).catch(() => null);
                            const sVal = (senderUserSnap && senderUserSnap.exists()) ? senderUserSnap.val() : {};
                            const sName = sVal.displayName || sig.senderName || 'Player';
                            const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(sName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;
                            const sPhoto = resolveUserAvatarUrl(sVal, sig.senderPhoto || defaultPhoto);
                            const reqData = {
                                senderUid: sUid,
                                senderName: sName,
                                senderPhoto: sPhoto,
                                status: 'pending',
                                timestamp: Number(senderReqVal?.timestamp) || Number(sig.timestamp) || Date.now()
                            };
                            requestsMap.set(sUid, reqData);
                            set(ref(db, `users/${uid}/incomingRequests/${sUid}`), reqData).catch(() => {});
                        }
                    }
                }
            }
        } catch (e) {}

        const requests: any[] = [];
        for (const [sUid, reqData] of requestsMap.entries()) {
            const pairId = getChatPairId(uid, sUid);
            const [chk, relSnap, sUserSnap] = await Promise.all([
                get(ref(db, `users/${sUid}/sentFriendRequests/${uid}`)).catch(() => null),
                get(ref(db, `chats/rel_${pairId}`)).catch(() => null),
                get(ref(db, `users/${sUid}`)).catch(() => null)
            ]);
            const relVal = (relSnap && relSnap.exists()) ? relSnap.val() : null;
            const chkVal = (chk && chk.exists()) ? chk.val() : null;
            const isValidReq = Boolean(
                chkVal &&
                typeof chkVal === 'object' &&
                chkVal.status !== 'cancelled' &&
                chkVal.status !== 'rejected' &&
                chkVal.status !== 'accepted' &&
                relVal?.status !== 'friends'
            );
            if (isValidReq) {
                if (sUserSnap && sUserSnap.exists()) {
                    const sVal = sUserSnap.val();
                    reqData.senderName = sVal.displayName || reqData.senderName || 'Player';
                    const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(reqData.senderName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;
                    reqData.senderPhoto = resolveUserAvatarUrl(sVal, reqData.senderPhoto || defaultPhoto);
                }
                requests.push(reqData);
            } else {
                set(ref(db, `users/${uid}/incomingRequests/${sUid}`), { status: 'cancelled', senderUid: sUid, cancelledAt: Date.now() }).catch(() => {});
                remove(ref(db, `users/${uid}/incomingRequests/${sUid}`)).catch(() => {});
            }
        }

        requests.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (elements.friendRequestsBadge) {
            elements.friendRequestsBadge.textContent = String(requests.length);
            elements.friendRequestsBadge.style.display = requests.length > 0 ? 'inline-block' : 'none';
        }
        if (elements.friendsSectionRequestsBadge) {
            elements.friendsSectionRequestsBadge.textContent = String(requests.length);
            elements.friendsSectionRequestsBadge.style.display = requests.length > 0 ? 'inline-block' : 'none';
        }

        listEl.innerHTML = '';
        if (requests.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        renderFriendRequestsList(requests);
    } catch (e) {
        console.error("Load friend requests error:", e);
        listEl.innerHTML = '<p class="text-danger text-center">Failed to load requests.</p>';
    }
}

function renderFriendRequestsList(requests: any[]) {
    const listEl = elements.friendRequestsListContainerEl;
    const emptyEl = elements.noFriendRequestsMessageEl;
    if (!listEl) return;

    if (!requests || requests.length === 0) {
        listEl.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    let html = '';
    requests.forEach((req) => {
        const senderName = req.senderName || 'Player';
        const senderPhoto = req.senderPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;
        const timeAgo = req.timestamp ? formatDate(req.timestamp) : 'Recently';

        html += `
            <div class="custom-card p-3 d-flex align-items-center justify-content-between gap-2" id="freq-${req.senderUid}">
                <div class="d-flex align-items-center gap-3 overflow-hidden cursor-pointer" onclick="viewPlayerProfile('${req.senderUid}')">
                    <img src="${senderPhoto}" class="rounded-circle border border-warning flex-shrink-0" style="width: 48px; height: 48px; object-fit: cover;" alt="${senderName}">
                    <div class="overflow-hidden">
                        <div class="fw-bold text-light text-truncate">${escapeHtml(senderName)}</div>
                        <small class="text-secondary d-block">${timeAgo}</small>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                    <button class="btn btn-sm btn-success fw-bold px-3 py-2 rounded-pill d-inline-flex align-items-center gap-1 shadow-sm" onclick="acceptFriendRequest('${req.senderUid}', '${escapeHtml(senderName)}', '${senderPhoto}')">
                        <i class="bi bi-check-lg"></i> Accept
                    </button>
                    <button class="btn btn-sm btn-outline-danger px-3 py-2 rounded-pill d-inline-flex align-items-center gap-1" onclick="rejectFriendRequest('${req.senderUid}')">
                        <i class="bi bi-x-lg"></i> Reject
                    </button>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}

// 8. Load Friends Data
async function loadFriendsData() {
    if (!currentUser) return;
    const listEl = elements.friendsListContainerEl;
    const emptyEl = elements.noFriendsMessageEl;
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-warning"></div></div>';
    if (emptyEl) emptyEl.style.display = 'none';

    try {
        const myUid = currentUser.uid;
        const friendsRef = ref(db, `users/${myUid}/friends`);
        const snap = await get(friendsRef);
        listEl.innerHTML = '';

        const rawFriends: any[] = [];
        if (snap.exists()) {
            snap.forEach((child) => {
                const val = child.val();
                if (val && typeof val === 'object') {
                    const fUid = val.friendUid || val.uid || child.key;
                    if (fUid) {
                        rawFriends.push({
                            ...val,
                            friendUid: fUid
                        });
                    }
                }
            });
        }

        // Verify against shared chats/rel_${pairId} to ensure unfriended users are removed
        const relSnaps = await Promise.allSettled(
            rawFriends.map(f => get(ref(db, `chats/rel_${getChatPairId(myUid, f.friendUid)}`)))
        );

        const friends: any[] = [];
        for (let i = 0; i < rawFriends.length; i++) {
            const f = rawFriends[i];
            const rRes = relSnaps[i];
            if (rRes.status === 'fulfilled' && rRes.value.exists()) {
                const relVal = rRes.value.val();
                if (relVal && relVal.status === 'unfriended') {
                    remove(ref(db, `users/${myUid}/friends/${f.friendUid}`)).catch(() => {});
                    remove(ref(db, `users/${myUid}/conversations/${f.friendUid}`)).catch(() => {});
                    continue;
                }
            }
            friends.push(f);
        }

        currentFriendsCache = friends;
        syncFriendRelListeners(myUid, friends);
        if (elements.friendsCountBadge) {
            elements.friendsCountBadge.textContent = String(friends.length);
            elements.friendsCountBadge.style.display = friends.length > 0 ? 'inline-block' : 'none';
        }

        if (friends.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        renderFriendsList(friends);
    } catch (e) {
        console.error("Load friends error:", e);
        listEl.innerHTML = '<p class="text-danger text-center">Failed to load friends.</p>';
    }
}

async function renderFriendsList(friends: any[]) {
    const listEl = elements.friendsListContainerEl;
    const emptyEl = elements.noFriendsMessageEl;
    if (!listEl) return;

    if (!friends || friends.length === 0) {
        listEl.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    // Fetch presence status & avatar for each friend in parallel
    const presencePromises = friends.map(f => get(ref(db, `users/${f.friendUid}`)));
    const snapshots = await Promise.allSettled(presencePromises);

    let html = '';
    friends.forEach((friend, idx) => {
        const friendUid = friend.friendUid || friend.uid;
        if (!friendUid) return;
        let displayName = friend.displayName || 'Player';
        const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;
        let photoURL = friend.photoURL || defaultPhoto;

        let isOnline = false;
        let lastSeenText = 'Offline';
        const res = snapshots[idx];
        if (res.status === 'fulfilled' && res.value.exists()) {
            const uData = res.value.val();
            displayName = uData.displayName || displayName;
            photoURL = resolveUserAvatarUrl(uData, photoURL);
            isOnline = !!uData.isOnline;
            if (isOnline) {
                lastSeenText = 'Online';
            } else if (uData.lastSeen) {
                lastSeenText = `Last seen ${formatDate(uData.lastSeen)}`;
            }
        }

        const isBlockedByMe = !!userProfile?.blockedUsers?.[friendUid];

        html += `
            <div class="custom-card p-3 d-flex align-items-center justify-content-between gap-2" id="friend-card-${friendUid}">
                <div class="d-flex align-items-center gap-3 overflow-hidden cursor-pointer" onclick="viewPlayerProfile('${friendUid}')">
                    <div class="position-relative flex-shrink-0">
                        <img src="${photoURL}" class="rounded-circle border border-warning" style="width: 48px; height: 48px; object-fit: cover;" alt="${displayName}">
                        <span class="online-dot-sm ${isOnline ? 'online' : 'offline'}"></span>
                    </div>
                    <div class="overflow-hidden">
                        <div class="fw-bold text-light text-truncate">${escapeHtml(displayName)} ${isBlockedByMe ? '<span class="badge bg-danger ms-1" style="font-size: 0.62rem;">Blocked</span>' : ''}</div>
                        <small class="${isOnline ? 'text-success fw-bold' : 'text-secondary'} d-block">${lastSeenText}</small>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                    <button class="btn btn-sm btn-primary fw-bold px-3 py-2 rounded-pill d-inline-flex align-items-center gap-1 shadow-sm" onclick="openPersonalChatById('${friendUid}')">
                        <i class="bi bi-chat-dots-fill"></i> Message
                    </button>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary rounded-circle" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="width: 34px; height: 34px; padding: 0;">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-dark dropdown-menu-end shadow">
                            <li><button type="button" class="dropdown-item btn-friend-view-profile" data-uid="${friendUid}"><i class="bi bi-person me-2"></i> View Profile</button></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><button type="button" class="dropdown-item text-warning btn-friend-unfriend" data-uid="${friendUid}"><i class="bi bi-person-x me-2"></i> Unfriend</button></li>
                            <li><button type="button" class="dropdown-item text-danger btn-friend-block" data-uid="${friendUid}"><i class="bi ${isBlockedByMe ? 'bi-unlock text-success' : 'bi-slash-circle'} me-2"></i> ${isBlockedByMe ? 'Unblock User' : 'Block User'}</button></li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
    listEl.querySelectorAll('.btn-friend-view-profile').forEach(btn => {
        btn.addEventListener('click', (e: any) => {
            e.preventDefault();
            e.stopPropagation();
            const uid = e.currentTarget.dataset.uid;
            if (uid) (window as any).viewPlayerProfile(uid);
        });
    });
    listEl.querySelectorAll('.btn-friend-unfriend').forEach(btn => {
        btn.addEventListener('click', (e: any) => {
            e.preventDefault();
            e.stopPropagation();
            const uid = e.currentTarget.dataset.uid;
            if (uid) removeFriend(uid);
        });
    });
    listEl.querySelectorAll('.btn-friend-block').forEach(btn => {
        btn.addEventListener('click', (e: any) => {
            e.preventDefault();
            e.stopPropagation();
            const uid = e.currentTarget.dataset.uid;
            if (uid) toggleBlockUser(uid);
        });
    });
}

// 9. Load Conversations Data
async function loadConversationsData() {
    if (!currentUser) return;
    const listEl = elements.conversationsListContainerEl;
    const emptyEl = elements.noConversationsMessageEl;
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-warning"></div></div>';
    if (emptyEl) emptyEl.style.display = 'none';

    try {
        const myUid = currentUser.uid;
        const convRef = ref(db, `users/${myUid}/conversations`);
        const snap = await get(convRef);
        listEl.innerHTML = '';

        if (!snap.exists()) {
            currentConversationsCache = [];
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        const rawConvs: any[] = [];
        snap.forEach((child) => {
            const val = child.val();
            const cKey = child.key || '';
            if (val && typeof val === 'object') {
                const fUid = val.friendUid || cKey;
                if (fUid && val.lastMessage) {
                    rawConvs.push({
                        ...val,
                        friendUid: fUid
                    });
                } else if (cKey) {
                    remove(ref(db, `users/${myUid}/conversations/${cKey}`)).catch(() => {});
                }
            }
        });

        const relSnaps = await Promise.allSettled(
            rawConvs.map(c => get(ref(db, `chats/rel_${getChatPairId(myUid, c.friendUid)}`)))
        );

        const convs: any[] = [];
        for (let i = 0; i < rawConvs.length; i++) {
            const c = rawConvs[i];
            const rRes = relSnaps[i];
            if (rRes.status === 'fulfilled' && rRes.value.exists()) {
                const relVal = rRes.value.val();
                if (relVal && relVal.status === 'unfriended') {
                    remove(ref(db, `users/${myUid}/conversations/${c.friendUid}`)).catch(() => {});
                    remove(ref(db, `users/${myUid}/friends/${c.friendUid}`)).catch(() => {});
                    continue;
                }
                if (relVal && relVal.clearedAt && Number(c.lastMessageTimestamp || 0) <= Number(relVal.clearedAt)) {
                    remove(ref(db, `users/${myUid}/conversations/${c.friendUid}`)).catch(() => {});
                    continue;
                }
                const theirReadTs = Number(relVal?.[`lastRead_${c.friendUid}`] || 0);
                if (c.lastMessageSenderUid === myUid && theirReadTs >= Number(c.lastMessageTimestamp || 0)) {
                    c.lastMessageStatus = 'read';
                    update(ref(db, `users/${myUid}/conversations/${c.friendUid}`), { lastMessageStatus: 'read' }).catch(() => {});
                }
            }
            convs.push(c);
        }

        convs.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));

        currentConversationsCache = convs;
        if (convs.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        renderConversationsList(convs);
    } catch (e) {
        console.error("Load conversations error:", e);
        listEl.innerHTML = '<p class="text-danger text-center">Failed to load conversations.</p>';
    }
}

async function renderConversationsList(conversations: any[]) {
    const listEl = elements.conversationsListContainerEl;
    const emptyEl = elements.noConversationsMessageEl;
    if (!listEl) return;

    if (!conversations || conversations.length === 0) {
        listEl.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    // Fetch live user presence & avatar for conversations
    const presencePromises = conversations.map(c => get(ref(db, `users/${c.friendUid}`)));
    const snapshots = await Promise.allSettled(presencePromises);

    let html = '';
    conversations.forEach((conv, idx) => {
        const friendUid = conv.friendUid;
        if (!friendUid) return;
        let displayName = conv.friendName || 'Player';
        const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;
        let photoURL = conv.friendPhoto || defaultPhoto;
        const timeAgo = conv.lastMessageTimestamp ? formatDate(conv.lastMessageTimestamp) : '';
        const unread = conv.unreadCount || 0;

        let isOnline = false;
        const res = snapshots[idx];
        if (res.status === 'fulfilled' && res.value.exists()) {
            const uData = res.value.val();
            displayName = uData.displayName || displayName;
            photoURL = resolveUserAvatarUrl(uData, photoURL);
            isOnline = !!uData?.isOnline;
        }

        let lastMsgPrefix = '';
        if (conv.lastMessageSenderUid === currentUser?.uid) {
            if (conv.lastMessageStatus === 'read') {
                lastMsgPrefix = '<span class="pc-tick read me-1" title="Seen"><i class="bi bi-check2-all"></i></span>';
            } else if (conv.lastMessageStatus === 'delivered') {
                lastMsgPrefix = '<span class="pc-tick delivered me-1" title="Delivered"><i class="bi bi-check2-all"></i></span>';
            } else {
                lastMsgPrefix = '<span class="pc-tick sent me-1" title="Sent"><i class="bi bi-check2"></i></span>';
            }
        }

        const isBlockedByMe = !!userProfile?.blockedUsers?.[friendUid];

        html += `
            <div class="custom-card p-3 d-flex align-items-center justify-content-between gap-2 conversation-card cursor-pointer" id="conv-card-${friendUid}">
                <div class="d-flex align-items-center gap-3 overflow-hidden flex-grow-1 conv-main-click-area" data-uid="${friendUid}">
                    <div class="position-relative flex-shrink-0">
                        <img src="${photoURL}" class="rounded-circle border border-warning" style="width: 50px; height: 50px; object-fit: cover;" alt="${displayName}">
                        <span class="online-dot-sm ${isOnline ? 'online' : 'offline'}"></span>
                    </div>
                    <div class="overflow-hidden flex-grow-1">
                        <div class="d-flex align-items-center justify-content-between mb-1">
                            <span class="fw-bold text-light text-truncate">${escapeHtml(displayName)} ${isBlockedByMe ? '<span class="badge bg-danger ms-1" style="font-size: 0.62rem;">Blocked</span>' : ''}</span>
                            <small class="text-secondary flex-shrink-0 ms-2" style="font-size: 0.72rem;">${timeAgo}</small>
                        </div>
                        <div class="d-flex align-items-center justify-content-between">
                            <p class="small text-secondary mb-0 text-truncate" style="max-width: 85%;">
                                ${lastMsgPrefix}${escapeHtml(conv.lastMessage || 'No messages yet')}
                            </p>
                            ${unread > 0 ? `<span class="badge bg-danger rounded-pill flex-shrink-0">${unread}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="dropdown flex-shrink-0 ms-1">
                    <button class="btn btn-sm btn-outline-secondary rounded-circle btn-conv-menu-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="width: 34px; height: 34px; padding: 0;">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-dark dropdown-menu-end shadow">
                        <li><button type="button" class="dropdown-item btn-conv-view-profile" data-uid="${friendUid}"><i class="bi bi-person me-2"></i> View Profile</button></li>
                        <li><button type="button" class="dropdown-item btn-conv-clear-chat" data-uid="${friendUid}"><i class="bi bi-trash3 me-2"></i> Clear Chat</button></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><button type="button" class="dropdown-item text-warning btn-conv-unfriend" data-uid="${friendUid}"><i class="bi bi-person-x me-2"></i> Unfriend</button></li>
                        <li><button type="button" class="dropdown-item text-danger btn-conv-block" data-uid="${friendUid}"><i class="bi ${isBlockedByMe ? 'bi-unlock text-success' : 'bi-slash-circle'} me-2"></i> ${isBlockedByMe ? 'Unblock User' : 'Block User'}</button></li>
                    </ul>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll('.conv-main-click-area').forEach(area => {
        area.addEventListener('click', (e: any) => {
            const uid = e.currentTarget.dataset.uid;
            if (uid) (window as any).openPersonalChatById(uid);
        });
    });
    listEl.querySelectorAll('.btn-conv-menu-toggle').forEach(btn => {
        btn.addEventListener('click', (e: any) => {
            e.stopPropagation();
        });
    });
    listEl.querySelectorAll('.btn-conv-view-profile').forEach(btn => {
        btn.addEventListener('click', (e: any) => {
            e.preventDefault();
            e.stopPropagation();
            const uid = e.currentTarget.dataset.uid;
            if (uid) (window as any).viewPlayerProfile(uid);
        });
    });
    listEl.querySelectorAll('.btn-conv-clear-chat').forEach(btn => {
        btn.addEventListener('click', (e: any) => {
            e.preventDefault();
            e.stopPropagation();
            const uid = e.currentTarget.dataset.uid;
            if (uid) clearPersonalChat(uid);
        });
    });
    listEl.querySelectorAll('.btn-conv-unfriend').forEach(btn => {
        btn.addEventListener('click', (e: any) => {
            e.preventDefault();
            e.stopPropagation();
            const uid = e.currentTarget.dataset.uid;
            if (uid) removeFriend(uid);
        });
    });
    listEl.querySelectorAll('.btn-conv-block').forEach(btn => {
        btn.addEventListener('click', (e: any) => {
            e.preventDefault();
            e.stopPropagation();
            const uid = e.currentTarget.dataset.uid;
            if (uid) toggleBlockUser(uid);
        });
    });
}

// Quick helper to view profile by UID
(window as any).viewPlayerProfile = async (targetUid: string) => {
    try {
        if (!leaderboardStatsCache[targetUid]) {
            await ensureLeaderboardStatsCacheLoaded();
        }
        const snap = await get(ref(db, `users/${targetUid}`));
        if (snap.exists()) {
            const rankToUse = leaderboardStatsCache[targetUid]?.rank || 1;
            openLeaderboardUserProfile({ ...snap.val(), uid: targetUid }, rankToUse);
        } else {
            alert("User profile not found.");
        }
    } catch (e) {
        alert("Could not load user profile.");
    }
};

(window as any).openPersonalChatById = async (friendUid: string) => {
    try {
        const snap = await get(ref(db, `users/${friendUid}`));
        if (snap.exists()) {
            openPersonalChat({ ...snap.val(), uid: friendUid });
        } else {
            openPersonalChat({ uid: friendUid, displayName: 'Player' });
        }
    } catch (e) {
        openPersonalChat({ uid: friendUid, displayName: 'Player' });
    }
};

(window as any).acceptFriendRequest = acceptFriendRequest;
(window as any).rejectFriendRequest = rejectFriendRequest;
(window as any).removeFriend = removeFriend;

function renderEmptyPersonalChatPlaceholder(isCleared = false) {
    if (!elements.personalChatMessagesContainer || !activePersonalChatFriend) return;
    elements.personalChatMessagesContainer.innerHTML = `
        <div class="text-center py-5 my-auto" id="emptyChatPlaceholder">
            <div class="mb-3">
                <img src="${activePersonalChatFriend.photoURL}" class="rounded-circle border border-warning shadow" style="width: 70px; height: 70px; object-fit: cover;">
            </div>
            <h5 class="fw-bold text-light mb-1">${escapeHtml(activePersonalChatFriend.displayName)}</h5>
            <p class="small text-secondary mb-3">${isCleared ? 'Chat history has been cleared.' : 'You are now connected as friends! 🎉'}</p>
            <span class="badge bg-dark border border-secondary text-secondary px-3 py-2 rounded-pill">
                <i class="bi bi-shield-lock-fill me-1 text-warning"></i> Messages are private and end-to-end between friends
            </span>
            <p class="small text-secondary mt-3">Say hello and start the conversation! 👋</p>
        </div>
    `;
}

function markAllMyMessagesAsReadInUI(upToTs?: number) {
    document.querySelectorAll('.pc-msg-row.mine').forEach((row: any) => {
        const msgTs = Number(row.dataset?.ts || 0);
        if (upToTs && msgTs > 0 && msgTs > upToTs) return;
        const tickEl = row.querySelector('.pc-tick');
        if (tickEl && !tickEl.classList.contains('read')) {
            tickEl.className = 'pc-tick read';
            tickEl.setAttribute('title', 'Seen');
            tickEl.innerHTML = '<i class="bi bi-check2-all"></i>';
        }
    });
}

async function markChatMessagesAsSeen(myUid: string, friendUid: string, chatId: string) {
    const nowTs = Date.now();
    try {
        update(ref(db, `users/${myUid}/conversations/${friendUid}`), {
            unreadCount: 0,
            lastReadTimestamp: nowTs
        }).catch(() => {});

        update(ref(db, `chats/rel_${chatId}`), {
            [`lastRead_${myUid}`]: nowTs
        }).catch(() => {});

        const messagesRef = query(ref(db, `chats/p2p_${chatId}`), limitToLast(100));
        const snap = await get(messagesRef).catch(() => null);
        let markedAny = false;
        if (snap && snap.exists()) {
            const updatesObj: Record<string, any> = {};
            snap.forEach((child) => {
                const msg = child.val();
                const mKey = child.key;
                if (msg && mKey && msg.senderUid === friendUid && (!msg.read || !msg.delivered)) {
                    updatesObj[`${mKey}/delivered`] = true;
                    updatesObj[`${mKey}/read`] = true;
                    updatesObj[`${mKey}/seenAt`] = nowTs;
                    markedAny = true;
                }
            });
            if (markedAny) {
                await update(ref(db, `chats/p2p_${chatId}`), updatesObj).catch(() => {});
            }
        }

        push(ref(db, `chats/sig_${friendUid}`), {
            type: 'messages_seen',
            senderUid: myUid,
            seenAt: nowTs,
            timestamp: nowTs
        }).catch(() => {});
    } catch (e) {}
}

// 10. Open Personal Chat (Full Screen)
async function openPersonalChat(friend: any, navContext?: any) {
    if (!currentUser) {
        alert("Please login to message.");
        showSection('login-section');
        return;
    }

    const friendUid = friend.uid || friend.friendUid;
    if (!friendUid || friendUid === currentUser.uid) return;

    const myUid = currentUser.uid;
    const chatId = getChatPairId(myUid, friendUid);

    // Strict Security & Rules Verification: Must be confirmed friends in DB and not unfriended!
    try {
        const [friendSnap, relSnap, removedSnap, recFriendSnap] = await Promise.all([
            get(ref(db, `users/${myUid}/friends/${friendUid}`)).catch(() => null),
            get(ref(db, `chats/rel_${chatId}`)).catch(() => null),
            get(ref(db, `users/${myUid}/removedFriends/${friendUid}`)).catch(() => null),
            get(ref(db, `users/${friendUid}/friends/${myUid}`)).catch(() => null)
        ]);
        const relVal = (relSnap && relSnap.exists()) ? relSnap.val() : null;
        if (relVal && relVal.status === 'unfriended') {
            await remove(ref(db, `users/${myUid}/friends/${friendUid}`)).catch(() => {});
            await remove(ref(db, `users/${myUid}/conversations/${friendUid}`)).catch(() => {});
            alert("You are no longer friends with this player. Send a friend request to message again.");
            if (currentInspectedUser?.uid === friendUid) updateProfileFriendActionButton(currentInspectedUser);
            if (currentSectionId === 'friends-section') loadFriendsData();
            if (currentSectionId === 'messages-section') loadConversationsData();
            return;
        }
        if (!friendSnap || !friendSnap.exists()) {
            if ((relVal && relVal.status === 'friends') || (recFriendSnap && recFriendSnap.exists() && (!removedSnap || !removedSnap.exists()) && !relVal?.status)) {
                const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.displayName || friend.friendName || 'Player')}&background=0F172A&color=E2E8F0&bold=true&size=50`;
                await set(ref(db, `users/${myUid}/friends/${friendUid}`), {
                    friendUid,
                    displayName: friend.displayName || friend.friendName || 'Player',
                    photoURL: resolveUserAvatarUrl(friend, friend.photoURL || friend.friendPhoto || defaultPhoto),
                    addedAt: Date.now()
                });
            } else {
                alert("You must be friends with this player to send messages.");
                return;
            }
        }
    } catch (e) {
        return;
    }

    // Save previous navigation context for system back button
    const wasModalOpen = !!(elements.leaderboardUserProfileModalEl && elements.leaderboardUserProfileModalEl.classList.contains('show'));
    chatPreviousNavigation = {
        sectionId: currentSectionId,
        wasModalOpen: wasModalOpen || (navContext?.type === 'modal'),
        inspectedUser: currentInspectedUser || navContext?.inspectedUser || friend,
        inspectedRank: 1
    };

    if (wasModalOpen && elements.leaderboardUserProfileModalInstance) {
        elements.leaderboardUserProfileModalInstance.hide();
    }

    const fDisplayName = friend.displayName || friend.friendName || 'Player';
    const fDefaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(fDisplayName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;
    activePersonalChatFriend = {
        uid: friendUid,
        displayName: fDisplayName,
        photoURL: resolveUserAvatarUrl(friend, friend.photoURL || friend.friendPhoto || fDefaultPhoto)
    };

    // Clean up previous listeners
    cleanupPersonalChat();

    // Populate UI
    elements.personalChatNameEl.textContent = activePersonalChatFriend.displayName;
    elements.personalChatAvatarEl.src = activePersonalChatFriend.photoURL;
    elements.personalChatStatusEl.textContent = 'Connecting...';
    elements.personalChatOnlineDot.classList.remove('online');
    elements.personalChatMessagesContainer.innerHTML = '<div class="text-center p-4"><div class="spinner-border spinner-border-sm text-warning"></div></div>';
    elements.personalChatTypingEl.style.display = 'none';

    // Show full-screen chat page
    elements.personalChatSection.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Mark messages from friend as seen immediately & reset unread count
    markChatMessagesAsSeen(myUid, friendUid, chatId);

    // 1. Live status listener for friend's presence & avatar
    const friendRef = ref(db, `users/${friendUid}`);
    activeChatStatusListener = onValue(friendRef, (snap) => {
        if (!snap.exists() || !activePersonalChatFriend) return;
        const data = snap.val();
        if (data.displayName) {
            activePersonalChatFriend.displayName = data.displayName;
            elements.personalChatNameEl.textContent = data.displayName;
        }
        const resolvedAv = resolveUserAvatarUrl(data, activePersonalChatFriend.photoURL);
        if (resolvedAv) {
            activePersonalChatFriend.photoURL = resolvedAv;
            elements.personalChatAvatarEl.src = resolvedAv;
        }
        if (data.isOnline) {
            elements.personalChatOnlineDot.classList.add('online');
            elements.personalChatStatusEl.textContent = 'Online';
            elements.personalChatStatusEl.className = 'personal-chat-status text-success fw-bold';
        } else {
            elements.personalChatOnlineDot.classList.remove('online');
            const lastSeenText = data.lastSeen ? formatDate(data.lastSeen) : 'Offline';
            elements.personalChatStatusEl.textContent = `Last seen ${lastSeenText}`;
            elements.personalChatStatusEl.className = 'personal-chat-status text-secondary';
        }
    });

    // 2. Typing indicator listener
    const typingRef = ref(db, `users/${friendUid}/isTypingTo`);
    activeChatTypingListener = onValue(typingRef, (snap) => {
        const typingTo = snap.val();
        const isTyping = typingTo === currentUser?.uid;
        if (isTyping) {
            elements.personalChatTypingText.textContent = `${activePersonalChatFriend?.displayName || 'Friend'} is typing...`;
            elements.personalChatTypingEl.style.display = 'block';
            scrollChatToBottom();
        } else {
            elements.personalChatTypingEl.style.display = 'none';
        }
    });

    // 3. Shared Relationship & Read / Block / Clear / Unfriend listener on chats/rel_${chatId}
    const relRef = ref(db, `chats/rel_${chatId}`);
    activeChatRelListener = onValue(relRef, (snap) => {
        if (!snap.exists() || !currentUser || activePersonalChatFriend?.uid !== friendUid) return;
        const rel = snap.val();
        if (!rel || typeof rel !== 'object') return;

        if (rel.status === 'unfriended') {
            closePersonalChat();
            return;
        }

        const theirReadTs = Number(rel[`lastRead_${friendUid}`] || 0);
        if (theirReadTs > 0) {
            activeFriendLastReadTs = Math.max(activeFriendLastReadTs, theirReadTs);
            markAllMyMessagesAsReadInUI(activeFriendLastReadTs);
            const myConv = currentConversationsCache.find(c => c.friendUid === friendUid);
            if (myConv && myConv.lastMessageSenderUid === currentUser.uid && myConv.lastMessageStatus !== 'read') {
                update(ref(db, `users/${currentUser.uid}/conversations/${friendUid}`), { lastMessageStatus: 'read' }).catch(() => {});
            }
        }

        const clearedAt = Number(rel.clearedAt || 0);
        if (clearedAt > 0 && clearedAt > activeChatClearedAt) {
            activeChatClearedAt = clearedAt;
            renderEmptyPersonalChatPlaceholder(true);
        }

        checkBlockStatus(friendUid);
    });

    // Fallback read listener on friend's conversation lastReadTimestamp
    const friendReadRef = ref(db, `users/${friendUid}/conversations/${currentUser.uid}/lastReadTimestamp`);
    activeChatReadListener = onValue(friendReadRef, (snap) => {
        const readTs = Number(snap.val() || 0);
        if (readTs > 0) {
            activeFriendLastReadTs = Math.max(activeFriendLastReadTs, readTs);
            markAllMyMessagesAsReadInUI(activeFriendLastReadTs);
        }
    });

    // 4. Messages listener (onChildAdded, onChildChanged, onChildRemoved)
    const messagesRef = query(ref(db, `chats/p2p_${chatId}`), limitToLast(100));

    Promise.all([
        get(messagesRef).catch(() => null),
        get(relRef).catch(() => null)
    ]).then(([snapshot, relSnap]) => {
        if (!activePersonalChatFriend || activePersonalChatFriend.uid !== friendUid) return;
        const relVal = (relSnap && relSnap.exists()) ? relSnap.val() : null;
        if (relVal) {
            activeFriendLastReadTs = Math.max(activeFriendLastReadTs, Number(relVal[`lastRead_${friendUid}`] || 0));
            activeChatClearedAt = Math.max(activeChatClearedAt, Number(relVal.clearedAt || 0));
        }

        elements.personalChatMessagesContainer.innerHTML = '';
        let renderedCount = 0;
        if (snapshot && snapshot.exists()) {
            snapshot.forEach((child) => {
                const msg = child.val();
                if (!msg) return;
                if (activeChatClearedAt > 0 && Number(msg.timestamp || 0) <= activeChatClearedAt) return;
                const msgWithKey = { ...msg, id: msg.id || child.key };
                appendPersonalChatMessage(msgWithKey, false);
                renderedCount++;
            });
        }
        if (renderedCount === 0) {
            renderEmptyPersonalChatPlaceholder(activeChatClearedAt > 0);
        } else {
            if (activeFriendLastReadTs > 0) {
                markAllMyMessagesAsReadInUI(activeFriendLastReadTs);
            }
            scrollChatToBottom();
        }
    });

    const childAddedFunc = onChildAdded(messagesRef, (snapshot) => {
        const msg = snapshot.val();
        if (!msg || !activePersonalChatFriend || activePersonalChatFriend.uid !== friendUid) return;
        if (activeChatClearedAt > 0 && Number(msg.timestamp || 0) <= activeChatClearedAt) return;

        const emptyPlaceholder = document.getElementById('emptyChatPlaceholder');
        if (emptyPlaceholder) emptyPlaceholder.remove();

        const msgId = msg.id || snapshot.key;
        const msgWithKey = { ...msg, id: msgId };
        const existingEl = document.getElementById(`msg-${msgId}`);
        if (!existingEl) {
            appendPersonalChatMessage(msgWithKey, false);
            scrollChatToBottom();
        } else {
            updatePersonalChatMessageUI(msgWithKey);
        }

        if (msg.receiverUid === currentUser?.uid && currentUser) {
            const nowTs = Date.now();
            if (!msg.read || !msg.delivered) {
                update(ref(db, `chats/p2p_${chatId}/${snapshot.key}`), {
                    delivered: true,
                    read: true,
                    seenAt: nowTs
                }).catch(() => {});
            }
            update(ref(db, `users/${currentUser.uid}/conversations/${friendUid}`), {
                unreadCount: 0,
                lastReadTimestamp: nowTs,
                lastMessageStatus: 'read'
            }).catch(() => {});
            update(ref(db, `chats/rel_${chatId}`), {
                [`lastRead_${currentUser.uid}`]: nowTs
            }).catch(() => {});
            push(ref(db, `chats/sig_${friendUid}`), {
                type: 'messages_seen',
                senderUid: currentUser.uid,
                seenAt: nowTs,
                timestamp: nowTs
            }).catch(() => {});
        }
    });

    const childChangedFunc = onChildChanged(messagesRef, (snapshot) => {
        const msg = snapshot.val();
        if (!msg || !activePersonalChatFriend || activePersonalChatFriend.uid !== friendUid) return;
        const msgId = msg.id || snapshot.key;
        updatePersonalChatMessageUI({ ...msg, id: msgId });
        if (msg.senderUid === currentUser?.uid && msg.read && currentUser) {
            const myConv = currentConversationsCache.find(c => c.friendUid === friendUid);
            if (myConv && myConv.lastMessageSenderUid === currentUser.uid && myConv.lastMessageStatus !== 'read') {
                update(ref(db, `users/${currentUser.uid}/conversations/${friendUid}`), { lastMessageStatus: 'read' }).catch(() => {});
            }
        }
    });

    const childRemovedFunc = onChildRemoved(messagesRef, (snapshot) => {
        const msg = snapshot.val();
        const msgId = msg?.id || snapshot.key;
        if (msgId) {
            const row = document.getElementById(`msg-${msgId}`);
            if (row) row.remove();
        }
        if (elements.personalChatMessagesContainer && elements.personalChatMessagesContainer.querySelectorAll('.pc-msg-row').length === 0) {
            renderEmptyPersonalChatPlaceholder(true);
        }
    });

    activeChatListener = {
        ref: messagesRef,
        childAdded: childAddedFunc,
        childChanged: childChangedFunc,
        childRemoved: childRemovedFunc
    };

    const myBlockRef = ref(db, `users/${currentUser.uid}/blockedUsers/${friendUid}`);
    activeChatBlockListener = onValue(myBlockRef, () => {
        checkBlockStatus(friendUid);
    });

    checkBlockStatus(friendUid);
}

// 11. Close Personal Chat and Clean Up
function closePersonalChat() {
    actuallyClosePersonalChat();
}

function actuallyClosePersonalChat() {
    elements.personalChatSection.style.display = 'none';
    document.body.style.removeProperty('overflow');
    cleanupPersonalChat();

    if (currentUser) {
        set(ref(db, `users/${currentUser.uid}/isTypingTo`), null).catch(() => {});
    }
    activePersonalChatFriend = null;

    // Return to the EXACT previous screen or modal
    if (chatPreviousNavigation.wasModalOpen && chatPreviousNavigation.inspectedUser) {
        openLeaderboardUserProfile(chatPreviousNavigation.inspectedUser, chatPreviousNavigation.inspectedRank || 1);
    } else if (chatPreviousNavigation.sectionId) {
        showSection(chatPreviousNavigation.sectionId);
    } else {
        showSection('profile-section');
    }
}

function cleanupPersonalChat() {
    activeFriendLastReadTs = 0;
    activeChatClearedAt = 0;
    if (activeChatListener) {
        try {
            if (activeChatListener.childAdded) off(activeChatListener.ref, 'child_added', activeChatListener.childAdded);
            if (activeChatListener.childChanged) off(activeChatListener.ref, 'child_changed', activeChatListener.childChanged);
            if (activeChatListener.childRemoved) off(activeChatListener.ref, 'child_removed', activeChatListener.childRemoved);
        } catch (e) {}
        activeChatListener = null;
    }
    if (activeChatStatusListener && activePersonalChatFriend) {
        try {
            off(ref(db, `users/${activePersonalChatFriend.uid}`), 'value', activeChatStatusListener);
        } catch (e) {}
        activeChatStatusListener = null;
    }
    if (activeChatTypingListener && activePersonalChatFriend) {
        try {
            off(ref(db, `users/${activePersonalChatFriend.uid}/isTypingTo`), 'value', activeChatTypingListener);
        } catch (e) {}
        activeChatTypingListener = null;
    }
    if (activeChatRelListener && activePersonalChatFriend && currentUser) {
        try {
            const pairId = getChatPairId(currentUser.uid, activePersonalChatFriend.uid);
            off(ref(db, `chats/rel_${pairId}`), 'value', activeChatRelListener);
        } catch (e) {}
        activeChatRelListener = null;
    }
    if (activeChatReadListener && activePersonalChatFriend && currentUser) {
        try {
            off(ref(db, `users/${activePersonalChatFriend.uid}/conversations/${currentUser.uid}/lastReadTimestamp`), 'value', activeChatReadListener);
        } catch (e) {}
        activeChatReadListener = null;
    }
    if (activeChatBlockListener && activePersonalChatFriend && currentUser) {
        try {
            off(ref(db, `users/${currentUser.uid}/blockedUsers/${activePersonalChatFriend.uid}`), 'value', activeChatBlockListener);
        } catch (e) {}
        activeChatBlockListener = null;
    }
}

function scrollChatToBottom() {
    requestAnimationFrame(() => {
        if (elements.personalChatBodyEl) {
            elements.personalChatBodyEl.scrollTop = elements.personalChatBodyEl.scrollHeight;
        }
    });
}

// 12. Submit Message in Personal Chat
async function handlePersonalChatSubmit(e: any) {
    e.preventDefault();
    if (!currentUser || !activePersonalChatFriend) return;

    const messageText = elements.personalChatInput.value.trim();
    if (!messageText) return;

    const friendUid = activePersonalChatFriend.uid;
    const chatId = getChatPairId(currentUser.uid, friendUid);

    // Verification before write (must still be friends and not unfriended)
    try {
        const [friendSnap, relSnap] = await Promise.all([
            get(ref(db, `users/${currentUser.uid}/friends/${friendUid}`)).catch(() => null),
            get(ref(db, `chats/rel_${chatId}`)).catch(() => null)
        ]);
        const relVal = (relSnap && relSnap.exists()) ? relSnap.val() : null;
        if (!friendSnap || !friendSnap.exists() || (relVal && relVal.status === 'unfriended')) {
            if (relVal && relVal.status === 'unfriended') {
                await remove(ref(db, `users/${currentUser.uid}/friends/${friendUid}`)).catch(() => {});
                await remove(ref(db, `users/${currentUser.uid}/conversations/${friendUid}`)).catch(() => {});
            }
            alert("Cannot send message. You are no longer friends with this player. Send a friend request to connect again.");
            closePersonalChat();
            return;
        }
    } catch (e) {
        alert("Network error.");
        return;
    }

    const isBlocked = await checkIsBlocked(currentUser.uid, friendUid);
    if (isBlocked) {
        await checkBlockStatus(friendUid);
        alert("You cannot message this user due to block settings.");
        return;
    }

    clearTimeout(typingTimeout);
    set(ref(db, `users/${currentUser.uid}/isTypingTo`), null).catch(() => {});
    elements.personalChatInput.value = '';

    // Check receiver online status
    let isReceiverOnline = false;
    try {
        const recSnap = await get(ref(db, `users/${friendUid}/isOnline`));
        if (recSnap.val() === true) isReceiverOnline = true;
    } catch {}

    const newMsgRef = push(ref(db, `chats/p2p_${chatId}`));
    const nowTs = Date.now();
    const myName = userProfile.displayName || currentUser.email?.split('@')[0] || 'Player';
    const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(myName)}&background=0F172A&color=E2E8F0&bold=true&size=50`;
    const myPhoto = resolveUserAvatarUrl(userProfile, defaultPhoto);

    const msgData = {
        id: newMsgRef.key,
        chatId,
        senderUid: currentUser.uid,
        senderName: myName,
        receiverUid: friendUid,
        text: messageText,
        timestamp: nowTs,
        sent: true,
        delivered: isReceiverOnline,
        read: false,
        seenAt: null
    };

    try {
        await set(newMsgRef, msgData);

        // Update sender's conversation
        await set(ref(db, `users/${currentUser.uid}/conversations/${friendUid}`), {
            friendUid,
            friendName: activePersonalChatFriend.displayName,
            friendPhoto: activePersonalChatFriend.photoURL,
            lastMessage: messageText,
            lastMessageTimestamp: nowTs,
            lastMessageSenderUid: currentUser.uid,
            lastMessageStatus: isReceiverOnline ? 'delivered' : 'sent',
            unreadCount: 0
        });

        // Send signal to receiver via chats/sig_${friendUid}
        await push(ref(db, `chats/sig_${friendUid}`), {
            type: 'chat_message',
            msgId: newMsgRef.key,
            chatId,
            senderUid: currentUser.uid,
            senderName: myName,
            senderPhoto: myPhoto,
            text: messageText,
            timestamp: nowTs
        });
    } catch (err) {
        console.error("Failed to send message:", err);
        alert("Failed to send message. Please check connection.");
    }
}

// 13. Append Message Bubble to UI
function appendPersonalChatMessage(msg: any, prepend = false) {
    const isMyMessage = msg.senderUid === currentUser?.uid;
    const msgId = msg.id || `${msg.senderUid}_${msg.timestamp}`;

    const existing = document.getElementById(`msg-${msgId}`);
    if (existing) {
        updatePersonalChatMessageUI(msg);
        return;
    }

    const row = document.createElement('div');
    row.id = `msg-${msgId}`;
    row.className = `pc-msg-row ${isMyMessage ? 'mine' : 'theirs'}`;
    if (msg.timestamp) {
        row.dataset.ts = String(msg.timestamp);
    }

    const isRead = Boolean(msg.read) || (isMyMessage && activeFriendLastReadTs > 0 && Number(msg.timestamp || 0) <= activeFriendLastReadTs);
    let tickHtml = '';
    if (isMyMessage) {
        if (isRead) {
            tickHtml = `<span class="pc-tick read" title="Seen"><i class="bi bi-check2-all"></i></span>`;
        } else if (msg.delivered) {
            tickHtml = `<span class="pc-tick delivered" title="Delivered"><i class="bi bi-check2-all"></i></span>`;
        } else {
            tickHtml = `<span class="pc-tick sent" title="Sent"><i class="bi bi-check2"></i></span>`;
        }
    }

    const timeStr = formatMessageTime(msg.timestamp);

    row.innerHTML = `
        <div class="pc-bubble">
            ${escapeHtml(msg.text)}
        </div>
        <div class="pc-meta">
            <span>${timeStr}</span>
            ${tickHtml}
        </div>
    `;

    if (prepend) {
        elements.personalChatMessagesContainer.prepend(row);
    } else {
        elements.personalChatMessagesContainer.appendChild(row);
    }
}

function updatePersonalChatMessageUI(msg: any) {
    const msgId = msg.id || `${msg.senderUid}_${msg.timestamp}`;
    const row = document.getElementById(`msg-${msgId}`);
    if (!row) return;

    const isMyMessage = msg.senderUid === currentUser?.uid;
    if (isMyMessage) {
        const meta = row.querySelector('.pc-meta');
        if (meta) {
            const isRead = Boolean(msg.read) || (activeFriendLastReadTs > 0 && Number(msg.timestamp || 0) <= activeFriendLastReadTs);
            let tickHtml = '';
            if (isRead) {
                tickHtml = `<span class="pc-tick read" title="Seen"><i class="bi bi-check2-all"></i></span>`;
            } else if (msg.delivered) {
                tickHtml = `<span class="pc-tick delivered" title="Delivered"><i class="bi bi-check2-all"></i></span>`;
            } else {
                tickHtml = `<span class="pc-tick sent" title="Sent"><i class="bi bi-check2"></i></span>`;
            }
            const timeStr = formatMessageTime(msg.timestamp);
            meta.innerHTML = `<span>${timeStr}</span> ${tickHtml}`;
        }
    }
}

// 14. Block / Unblock User
async function toggleBlockUser(targetUid: string) {
    if (!currentUser || !targetUid) return;
    try {
        const myUid = currentUser.uid;
        const pairId = getChatPairId(myUid, targetUid);
        const blockRef = ref(db, `users/${myUid}/blockedUsers/${targetUid}`);
        const [snap, relSnap] = await Promise.all([
            get(blockRef).catch(() => null),
            get(ref(db, `chats/rel_${pairId}`)).catch(() => null)
        ]);
        const relVal = (relSnap && relSnap.exists()) ? relSnap.val() : null;
        const isCurrentlyBlocked = (snap && snap.exists() && snap.val() === true) || Boolean(relVal?.[`blockedBy_${myUid}`]);

        if (isCurrentlyBlocked) {
            await remove(blockRef).catch(() => {});
            await update(ref(db, `chats/rel_${pairId}`), {
                [`blockedBy_${myUid}`]: null
            }).catch(() => {});
            if (userProfile?.blockedUsers) {
                delete userProfile.blockedUsers[targetUid];
            }
            push(ref(db, `chats/sig_${targetUid}`), {
                type: 'user_unblocked',
                senderUid: myUid,
                timestamp: Date.now()
            }).catch(() => {});
        } else {
            await set(blockRef, true).catch(() => {});
            await update(ref(db, `chats/rel_${pairId}`), {
                [`blockedBy_${myUid}`]: true
            }).catch(() => {});
            if (!userProfile.blockedUsers) userProfile.blockedUsers = {};
            userProfile.blockedUsers[targetUid] = true;
            push(ref(db, `chats/sig_${targetUid}`), {
                type: 'user_blocked',
                senderUid: myUid,
                timestamp: Date.now()
            }).catch(() => {});
        }
        await checkBlockStatus(targetUid);
        if (currentSectionId === 'messages-section') renderConversationsList(currentConversationsCache);
        if (currentSectionId === 'friends-section') renderFriendsList(currentFriendsCache);
        if (currentInspectedUser?.uid === targetUid) updateProfileFriendActionButton(currentInspectedUser);
    } catch (e) {
        console.error("Failed to update block status:", e);
    }
}

async function checkIsBlocked(uid1: string, uid2: string): Promise<boolean> {
    try {
        const pairId = getChatPairId(uid1, uid2);
        const [b1, bBy, b2, relSnap] = await Promise.all([
            get(ref(db, `users/${uid1}/blockedUsers/${uid2}`)).catch(() => null),
            get(ref(db, `users/${uid1}/blockedByUsers/${uid2}`)).catch(() => null),
            get(ref(db, `users/${uid2}/blockedUsers/${uid1}`)).catch(() => null),
            get(ref(db, `chats/rel_${pairId}`)).catch(() => null)
        ]);
        if (b1 && b1.exists() && b1.val() === true) return true;
        if (bBy && bBy.exists() && bBy.val() === true) return true;
        if (b2 && b2.exists() && b2.val() === true) return true;
        if (relSnap && relSnap.exists()) {
            const rel = relSnap.val();
            if (rel && (rel[`blockedBy_${uid1}`] === true || rel[`blockedBy_${uid2}`] === true)) return true;
        }
    } catch {}
    return false;
}

async function checkBlockStatus(friendUid: string) {
    if (!currentUser || !friendUid) return;
    const myUid = currentUser.uid;
    const pairId = getChatPairId(myUid, friendUid);
    let isBlockedByMe = false;
    let isBlockedByThem = false;
    try {
        const [b1, bBy, b2, relSnap] = await Promise.all([
            get(ref(db, `users/${myUid}/blockedUsers/${friendUid}`)).catch(() => null),
            get(ref(db, `users/${myUid}/blockedByUsers/${friendUid}`)).catch(() => null),
            get(ref(db, `users/${friendUid}/blockedUsers/${myUid}`)).catch(() => null),
            get(ref(db, `chats/rel_${pairId}`)).catch(() => null)
        ]);
        const rel = (relSnap && relSnap.exists()) ? relSnap.val() : null;
        isBlockedByMe = Boolean((b1 && b1.exists() && b1.val() === true) || rel?.[`blockedBy_${myUid}`]);
        isBlockedByThem = Boolean((bBy && bBy.exists() && bBy.val() === true) || (b2 && b2.exists() && b2.val() === true) || rel?.[`blockedBy_${friendUid}`]);

        if (userProfile) {
            if (!userProfile.blockedUsers) userProfile.blockedUsers = {};
            if (isBlockedByMe) userProfile.blockedUsers[friendUid] = true;
            else delete userProfile.blockedUsers[friendUid];

            if (!userProfile.blockedByUsers) userProfile.blockedByUsers = {};
            if (isBlockedByThem) userProfile.blockedByUsers[friendUid] = true;
            else delete userProfile.blockedByUsers[friendUid];
        }
    } catch {}

    const isBlocked = isBlockedByMe || isBlockedByThem;

    if (elements.personalChatMenuBlock) {
        if (isBlockedByMe) {
            elements.personalChatMenuBlock.innerHTML = '<i class="bi bi-unlock me-2 text-success"></i> Unblock User';
            elements.personalChatMenuBlock.className = 'dropdown-item text-success fw-bold';
        } else {
            elements.personalChatMenuBlock.innerHTML = '<i class="bi bi-slash-circle me-2"></i> Block User';
            elements.personalChatMenuBlock.className = 'dropdown-item text-danger';
        }
    }

    if (elements.personalChatBlockedBanner) {
        if (isBlockedByMe) {
            elements.personalChatBlockedBanner.innerHTML = `<i class="bi bi-slash-circle me-1"></i> You have blocked this user. <a href="#" id="unblockUserBtn" class="text-white fw-bold text-decoration-underline ms-1">Unblock</a>`;
            elements.personalChatBlockedBanner.style.display = 'block';
            const unblockBtn = document.getElementById('unblockUserBtn');
            if (unblockBtn) {
                unblockBtn.onclick = (e) => {
                    e.preventDefault();
                    toggleBlockUser(friendUid);
                };
            }
        } else if (isBlockedByThem) {
            elements.personalChatBlockedBanner.innerHTML = `<i class="bi bi-slash-circle me-1"></i> You cannot message this user due to block settings.`;
            elements.personalChatBlockedBanner.style.display = 'block';
        } else {
            elements.personalChatBlockedBanner.style.display = 'none';
        }
    }
    if (elements.personalChatInput) {
        elements.personalChatInput.disabled = isBlocked;
        elements.personalChatInput.placeholder = isBlocked ? "Chat disabled (User blocked)" : "Type a message...";
        if (isBlocked) elements.personalChatInput.value = '';
    }
    if (elements.personalChatSendBtn) {
        elements.personalChatSendBtn.disabled = isBlocked;
    }
}

async function clearPersonalChat(targetFriendUid?: any) {
    if (!currentUser) return;
    const rawUid = isValidFirebaseKey(targetFriendUid) ? targetFriendUid.trim() : activePersonalChatFriend?.uid;
    if (!isValidFirebaseKey(rawUid)) return;
    const friendUid = rawUid.trim();
    try {
        const myUid = currentUser.uid;
        const chatId = getChatPairId(myUid, friendUid);
        if (!chatId) return;
        const nowTs = Date.now();

        // 1. Delete all messages from chats/p2p_${chatId}
        const p2pRef = ref(db, `chats/p2p_${chatId}`);
        const p2pSnap = await get(p2pRef).catch(() => null);
        if (p2pSnap && p2pSnap.exists()) {
            const nullUpdates: Record<string, null> = {};
            p2pSnap.forEach((c) => {
                if (c.key) nullUpdates[c.key] = null;
            });
            await update(p2pRef, nullUpdates).catch(() => {});
        }
        await remove(p2pRef).catch(() => {});

        // 2. Record clearedAt on shared relationship node so both users clear chat & conversation
        await update(ref(db, `chats/rel_${chatId}`), {
            clearedAt: nowTs,
            clearedBy: myUid
        }).catch(() => {});

        // 3. Remove conversation entry so all deleted messages are gone from Messages list too
        await remove(ref(db, `users/${myUid}/conversations/${friendUid}`)).catch(() => {});
        currentConversationsCache = currentConversationsCache.filter(c => c.friendUid !== friendUid);
        const convCard = document.getElementById(`conv-card-${friendUid}`);
        if (convCard) convCard.remove();

        // 4. Signal friend to clear their chat view & conversation entry in real-time
        push(ref(db, `chats/sig_${friendUid}`), {
            type: 'chat_cleared',
            senderUid: myUid,
            timestamp: nowTs
        }).catch(() => {});

        // 5. Update active chat UI if open
        if (activePersonalChatFriend?.uid === friendUid) {
            activeChatClearedAt = nowTs;
            renderEmptyPersonalChatPlaceholder(true);
        }
        if (currentSectionId === 'messages-section') {
            renderConversationsList(currentConversationsCache);
        }
    } catch (e) {
        console.error("Could not clear chat:", e);
    }
}

function startRechargeFlow() {
    if (!currentUser) {
        alert("Please login to add amount.");
        showSection('login-section');
        return;
    }
    currentRechargeData = { amount: 0, paymentMethod: null, upiId: null };
    elements.rechargeAmountInput.value = '';
    elements.rechargeUtrInput.value = '';
    clearStatusMessage(elements.rechargeStep1Status);
    clearStatusMessage(elements.rechargeStep2Status);
    clearStatusMessage(elements.rechargeStep3Status);
    elements.rechargeBalanceDisplay.textContent = extractBalances(userProfile).total.toFixed(2);
    showSection('recharge-section', 'wallet-section');
    goToRechargeStep(1);
}

function goToRechargeStep(step: number) {
    elements.rechargeStep1.style.display = (step === 1) ? 'block' : 'none';
    elements.rechargeStep2.style.display = (step === 2) ? 'block' : 'none';
    elements.rechargeStep3.style.display = (step === 3) ? 'block' : 'none';
}

function handleGoToStep2() {
    const amount = parseFloat(elements.rechargeAmountInput.value);
    if (isNaN(amount) || amount < 10 || amount > 1000) {
        showStatusMessage(elements.rechargeStep1Status, "Please enter an amount between ₹10 and ₹1000.", 'warning');
        return;
    }
    clearStatusMessage(elements.rechargeStep1Status);
    currentRechargeData.amount = amount;
    elements.rechargeAmountConfirm.textContent = amount.toFixed(2);
    goToRechargeStep(2);
}

function handleGoToStep3() {
    const selectedMethod = querySel<HTMLInputElement>('input[name="paymentMethod"]:checked');
    if (!selectedMethod) {
        showStatusMessage(elements.rechargeStep2Status, "Please select a payment method.", "warning");
        return;
    }

    // INSTANT DEPOSIT REDIRECTION
    if (selectedMethod.value === 'InstantDeposit') {
        window.open('https://cfpe.me/agentuu', '_blank');
        return;
    }

    clearStatusMessage(elements.rechargeStep2Status);
    currentRechargeData.paymentMethod = selectedMethod.value;
    currentRechargeData.upiId = appSettings.upiDetails || 'aashif4412@ibl';
    const qrCodeUrl = appSettings.qrCodeUrl || 'https://iili.io/FsMJsRV.md.png';

    elements.rechargeFinalAmount.textContent = currentRechargeData.amount.toFixed(2);
    elements.rechargePaymentMode.textContent = currentRechargeData.paymentMethod;
    elements.rechargeUpiId.textContent = currentRechargeData.upiId;
    if (elements.rechargeQrCodeImg) {
        elements.rechargeQrCodeImg.src = qrCodeUrl;
    }

    goToRechargeStep(3);
}

async function submitDepositRequest() {
    if (!currentUser) return;
    const utr = elements.rechargeUtrInput.value.trim();
    if (!utr) {
        showStatusMessage(elements.rechargeStep3Status, "Please enter the UTR/Transaction ID.", 'warning');
        return;
    }
    elements.rechargeSubmitBtn.disabled = true;
    elements.rechargeSubmitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Submitting...';
    showLoader(true);

    const depositRequest = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: userProfile.displayName || 'N/A',
        amount: currentRechargeData.amount,
        paymentMethod: currentRechargeData.paymentMethod,
        upiId: currentRechargeData.upiId,
        utr: utr,
        status: 'pending',
        timestamp: serverTimestamp()
    };

    try {
        const depositsRef = ref(db, 'deposits');
        const newDepRef = await push(depositsRef, depositRequest);
        await recordTransaction(currentUser.uid, 'deposit_request', currentRechargeData.amount, `Deposit Request (UTR: ${utr})`, {
            depositId: newDepRef.key,
            status: 'pending',
            utr: utr,
            paymentMethod: currentRechargeData.paymentMethod
        });
        set(ref(db, `users/${currentUser.uid}/deposits/${newDepRef.key}`), {
            ...depositRequest,
            id: newDepRef.key
        }).catch(() => {});

        alert("Deposit request submitted successfully! Your balance will be updated after verification by our team.");
        showSection('wallet-section');
        loadRecentTransactions();
    } catch (error: any) {
        showStatusMessage(elements.rechargeStep3Status, `Failed to submit request: ${error.message}`, 'danger');
    } finally {
        showLoader(false);
        elements.rechargeSubmitBtn.disabled = false;
        elements.rechargeSubmitBtn.innerHTML = 'Submit';
    }
}

function handleJoinTournamentClick(event: any) {
    if (!currentUser) {
        alert("Please login to join.");
        showSection('login-section');
        return;
    }
    const btn = event.currentTarget;
    const tId = btn.dataset.tournamentId;
    const fee = parseFloat(btn.dataset.fee || 0);
    const mode = btn.dataset.mode || 'Solo';

    if (!tId) return;

    elements.joinTournamentIdInput.value = tId;
    elements.joinTournamentFeeInput.value = String(fee);
    elements.joinTournamentModeInput.value = mode;

    elements.joinUsernameInput.value = userProfile.username || '';
    elements.joinGameUidInput.value = userProfile.gameUid || '';
    elements.joinTeammateUsernameInput.value = '';
    elements.joinTeammateGameUidInput.value = '';
    clearStatusMessage(elements.joinTournamentStatusMessage);

    if (mode === 'Duo') {
        const totalFee = fee * 2;
        if (totalFee > 0) {
            elements.joinFeeDisplayEl.innerHTML = `₹${totalFee.toFixed(2)} (₹${fee} per player)<br><small class="text-secondary fw-normal"><i class="bi bi-info-circle text-warning me-1"></i>Paid contests use <strong>Deposit &amp; Winning</strong> balance only (Bonus cash not usable).</small>`;
        } else {
            elements.joinFeeDisplayEl.textContent = `Free (₹0.00)`;
        }
        elements.joinDuoFieldsContainer.style.display = 'block';
        elements.joinTeammateUsernameInput.required = true;
        elements.joinTeammateGameUidInput.required = true;
    } else {
        if (fee > 0) {
            elements.joinFeeDisplayEl.innerHTML = `₹${fee.toFixed(2)}<br><small class="text-secondary fw-normal"><i class="bi bi-info-circle text-warning me-1"></i>Paid contests use <strong>Deposit &amp; Winning</strong> balance only (Bonus cash not usable).</small>`;
        } else {
            elements.joinFeeDisplayEl.textContent = `Free (₹0.00)`;
        }
        elements.joinDuoFieldsContainer.style.display = 'none';
        elements.joinTeammateUsernameInput.required = false;
        elements.joinTeammateGameUidInput.required = false;
    }

    elements.joinTournamentDetailsModalInstance?.show();
}

/* =========================================================
   CONFIRM AND JOIN TOURNAMENT + ₹10 REFERRAL REWARD
   ========================================================= */
let isJoiningTournament = false;

async function confirmAndJoinTournament() {
    if (!currentUser || isJoiningTournament) return;
    const tId = elements.joinTournamentIdInput.value;
    const singleFee = parseFloat(elements.joinTournamentFeeInput.value) || 0;
    const mode = elements.joinTournamentModeInput.value;
    const username = elements.joinUsernameInput.value.trim();
    const gameUid = elements.joinGameUidInput.value.trim();

    const teammateUsername = elements.joinTeammateUsernameInput.value.trim();
    const teammateGameUid = elements.joinTeammateGameUidInput.value.trim();

    const totalFee = (mode === 'Duo') ? singleFee * 2 : singleFee;

    if (!username || !gameUid) {
        showStatusMessage(elements.joinTournamentStatusMessage, 'Player Username and Game UID are required.', 'warning');
        return;
    }
    if (mode === 'Duo' && (!teammateUsername || !teammateGameUid)) {
        showStatusMessage(elements.joinTournamentStatusMessage, "Teammate's Username and UID are required for Duo mode.", 'warning');
        return;
    }

    clearStatusMessage(elements.joinTournamentStatusMessage);
    isJoiningTournament = true;
    const btn = elements.confirmJoinBtn;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Joining...';

    const uRef = ref(db, `users/${currentUser.uid}`);
    const tRef = ref(db, `tournaments/${tId}`);
    let tData: any = null;

    try {
        const [tSnap, uSnap] = await Promise.all([get(tRef), get(uRef)]);
        if (!tSnap.exists()) {
            throw new Error("Tournament not found.");
        }
        tData = tSnap.val();
        if (tData.status !== 'upcoming') {
            throw new Error("This tournament is no longer open for joining.");
        }
        const regPlayers = tData.registeredPlayers || {};
        const maxPlayers = Number(tData.maxPlayers) || 0;
        if (maxPlayers > 0 && Object.keys(regPlayers).length >= maxPlayers) {
            throw new Error("Tournament is already full.");
        }
        if (regPlayers[currentUser.uid] || uSnap.val()?.joinedTournaments?.[tId]) {
            throw new Error("You have already joined this tournament.");
        }

        const preBalances = extractBalances(uSnap.val() || userProfile);
        const spendableCash = (totalFee > 0) ? (preBalances.deposit + preBalances.winning) : preBalances.total;
        if (spendableCash < totalFee) {
            if (totalFee > 0) {
                throw new Error(`Insufficient balance. Paid tournaments can only be joined using Deposit and Winning cash (Bonus cash cannot be used). You have ₹${spendableCash.toFixed(2)} in Deposit + Winning, but need ₹${totalFee.toFixed(2)}. Please recharge to join.`);
            } else {
                throw new Error(`Insufficient balance. You need ₹${totalFee.toFixed(2)}.`);
            }
        }

        let insufficientErr = false;
        let alreadyJoinedErr = false;

        const transactionResult = await runTransaction(uRef, (profileData) => {
            if (!profileData) return profileData;
            if (profileData.joinedTournaments?.[tId]) {
                alreadyJoinedErr = true;
                return;
            }
            const pBalances = extractBalances(profileData);
            const deposit = pBalances.deposit;
            const winnings = pBalances.winning;
            const bonus = pBalances.bonus;
            const spendable = (totalFee > 0) ? (deposit + winnings) : (deposit + winnings + bonus);

            if (spendable < totalFee) {
                insufficientErr = true;
                return;
            }

            let remainingFee = totalFee;
            const feeDeductedFromDeposit = Math.min(deposit, remainingFee);
            remainingFee -= feeDeductedFromDeposit;

            const feeDeductedFromWinnings = Math.min(winnings, remainingFee);
            remainingFee -= feeDeductedFromWinnings;

            // Bonus cash is NEVER used or deducted for paid tournaments (totalFee > 0)
            const feeDeductedFromBonus = (totalFee > 0) ? 0 : Math.min(bonus, remainingFee);
            remainingFee -= feeDeductedFromBonus;

            profileData.depositBalance = Math.max(0, deposit - feeDeductedFromDeposit);
            profileData.winningCash = Math.max(0, winnings - feeDeductedFromWinnings);
            profileData.bonusCash = Math.max(0, bonus - feeDeductedFromBonus);
            profileData.balance = profileData.depositBalance + profileData.winningCash + profileData.bonusCash;
            profileData.walletBalance = profileData.balance;

            if (!profileData.joinedTournaments) profileData.joinedTournaments = {};
            profileData.joinedTournaments[tId] = true;
            profileData.username = username;
            profileData.gameUid = gameUid;
            if (!profileData.displayName) profileData.displayName = username;
            if (!profileData.uid && currentUser) profileData.uid = currentUser.uid;
            profileData.totalMatches = (profileData.totalMatches || 0) + 1;
            return profileData;
        });

        if (alreadyJoinedErr) {
            throw new Error("You have already joined this tournament.");
        }
        if (insufficientErr || !transactionResult.committed) {
            throw new Error(totalFee > 0
                ? `Insufficient balance. Paid tournaments can only be joined using Deposit and Winning cash (Bonus cash cannot be used). You need ₹${totalFee.toFixed(2)}.`
                : `Insufficient balance. You need ₹${totalFee.toFixed(2)}.`);
        }

        if (transactionResult.snapshot.exists()) {
            userProfile = transactionResult.snapshot.val();
            populateUserInfo(currentUser, userProfile);
        }

        const updates: any = {};
        const registrationData: any = {
            joinedAt: serverTimestamp(),
            username: username,
            displayName: userProfile.displayName || username,
            gameUid: gameUid
        };
        if (mode === 'Duo') {
            registrationData.teammateUsername = teammateUsername;
            registrationData.teammateGameUid = teammateGameUid;
        }
        updates[`tournaments/${tId}/registeredPlayers/${currentUser.uid}`] = registrationData;
        await update(ref(db), updates);

        await recordTransaction(currentUser.uid, 'tournament_join', -totalFee, `Joined: ${tData.name || 'Tournament'}`, { tournamentId: tId });

        // >>> REFERRAL REWARD LOGIC <<<
        // "Agr koi kisi ko refer krta hai toh usko 10 rs milega wo v jb wo 1 paid contest join krta hai"
        if (totalFee > 0 && userProfile.referredBy && !userProfile.referralRewardClaimed) {
            try {
                const referrerUid = userProfile.referredBy;
                const referrerRef = ref(db, `users/${referrerUid}`);
                await runTransaction(referrerRef, (refProf) => {
                    if (!refProf) return refProf;
                    const rBal = extractBalances(refProf);
                    refProf.winningCash = rBal.winning + 10;
                    refProf.depositBalance = rBal.deposit;
                    refProf.bonusCash = rBal.bonus;
                    refProf.balance = refProf.depositBalance + refProf.winningCash + refProf.bonusCash;
                    refProf.walletBalance = refProf.balance;
                    refProf.totalEarnings = (refProf.totalEarnings || 0) + 10;
                    refProf.referralEarnings = (refProf.referralEarnings || 0) + 10;
                    refProf.referralCount = (refProf.referralCount || 0) + 1;
                    return refProf;
                });

                await recordTransaction(referrerUid, 'referral_bonus', 10, `Referral Bonus: ${username} joined first paid contest!`);
                await update(ref(db, `users/${currentUser.uid}`), { referralRewardClaimed: true });

                // Update pending referrals
                const pQuery = query(ref(db, 'pendingReferrals'), orderByChild('referredUid'), equalTo(currentUser.uid));
                const pSnap = await get(pQuery);
                if (pSnap.exists()) {
                    pSnap.forEach(child => {
                        update(ref(db, `pendingReferrals/${child.key}`), {
                            status: 'completed',
                            rewardedAmount: 10,
                            rewardedAt: serverTimestamp()
                        });
                    });
                }
                console.log(`Referrer ${referrerUid} successfully rewarded ₹10 for first paid contest join!`);
            } catch (refErr) {
                console.error("Error rewarding referrer:", refErr);
            }
        }

        alert(`Joined successfully! ₹${totalFee.toFixed(2)} deducted.`);
        elements.joinTournamentDetailsModalInstance?.hide();

        if (currentSectionId === 'home-section') loadMyContests();
        if (currentSectionId === 'tournaments-section' && currentTournamentGameId) {
            const activeTab = querySel<HTMLButtonElement>('.tournament-tabs .tab-item.active')?.dataset.status || 'upcoming';
            filterTournaments(currentTournamentGameId, activeTab);
        }
        if (currentSectionId === 'wallet-section') loadRecentTransactions();

    } catch (e: any) {
        console.error("Join failed:", e);
        showStatusMessage(elements.joinTournamentStatusMessage, `Failed: ${e.message}`, 'danger');
    } finally {
        isJoiningTournament = false;
        btn.disabled = false;
        btn.innerHTML = 'Confirm & Join';
    }
}

function getClearedNotificationIds(uid: string): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    if (userProfile?.clearedNotificationIds && typeof userProfile.clearedNotificationIds === 'object') {
        Object.assign(map, userProfile.clearedNotificationIds);
    }
    try {
        const raw = localStorage.getItem(`winbig_cleared_notifs_ids_${uid}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') Object.assign(map, parsed);
        }
    } catch {}
    return map;
}

function saveClearedNotificationIds(uid: string, idsMap: Record<string, boolean>) {
    if (!userProfile.clearedNotificationIds) userProfile.clearedNotificationIds = {};
    Object.assign(userProfile.clearedNotificationIds, idsMap);
    try {
        localStorage.setItem(`winbig_cleared_notifs_ids_${uid}`, JSON.stringify(userProfile.clearedNotificationIds));
    } catch {}
    update(ref(db, `users/${uid}/clearedNotificationIds`), idsMap).catch(() => {});
}

let currentLoadedNotificationKeys: string[] = [];

async function clearAllNotifications() {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const idsToClear: Record<string, boolean> = {};
    currentLoadedNotificationKeys.forEach(k => {
        if (k) idsToClear[k] = true;
    });

    try {
        const [globalSnap, userSnap] = await Promise.all([
            get(ref(db, 'notifications')).catch(() => null),
            get(ref(db, `users/${uid}/notifications`)).catch(() => null)
        ]);
        if (globalSnap && globalSnap.exists()) {
            globalSnap.forEach((c) => { if (c.key) idsToClear[c.key] = true; });
        }
        if (userSnap && userSnap.exists()) {
            userSnap.forEach((c) => { if (c.key) idsToClear[c.key] = true; });
        }
    } catch {}

    if (Object.keys(idsToClear).length > 0) {
        saveClearedNotificationIds(uid, idsToClear);
    }

    const now = Date.now();
    userProfile.clearedNotificationsAt = now;
    userProfile.lastCheckedNotifications = now;
    try {
        localStorage.setItem(`winbig_cleared_notifs_ts_${uid}`, String(now));
    } catch {}

    currentLoadedNotificationKeys = [];
    if (elements.notificationsListEl) elements.notificationsListEl.innerHTML = '';
    if (elements.notificationsEmptyMsgEl) elements.notificationsEmptyMsgEl.style.display = 'block';
    if (elements.notificationBadge) elements.notificationBadge.style.display = 'none';
    if (elements.clearAllNotificationsBtn) elements.clearAllNotificationsBtn.style.display = 'none';

    await remove(ref(db, `users/${uid}/notifications`)).catch(() => {});
    await update(ref(db, `users/${uid}`), {
        clearedNotificationsAt: now,
        lastCheckedNotifications: now
    }).catch(() => {});
    remove(ref(db, 'notifications')).catch(() => {});
}

async function deleteSingleNotification(notifKey: string, isUserNotif: boolean) {
    if (!currentUser || !notifKey) return;
    const uid = currentUser.uid;
    saveClearedNotificationIds(uid, { [notifKey]: true });
    if (isUserNotif) {
        remove(ref(db, `users/${uid}/notifications/${notifKey}`)).catch(() => {});
    }
    const itemEl = document.getElementById(`notif-item-${notifKey}`);
    if (itemEl) itemEl.remove();
    currentLoadedNotificationKeys = currentLoadedNotificationKeys.filter(k => k !== notifKey);
    if (elements.notificationsListEl && elements.notificationsListEl.children.length === 0) {
        if (elements.notificationsEmptyMsgEl) elements.notificationsEmptyMsgEl.style.display = 'block';
        if (elements.clearAllNotificationsBtn) elements.clearAllNotificationsBtn.style.display = 'none';
    }
}

async function loadAndDisplayNotifications() {
    if (!currentUser) return;
    const listEl = elements.notificationsListEl;
    const badgeEl = elements.notificationBadge;
    const emptyMsgEl = elements.notificationsEmptyMsgEl;

    listEl.innerHTML = '';
    if (badgeEl) badgeEl.style.display = 'none';
    if (emptyMsgEl) emptyMsgEl.style.display = 'none';

    try {
        const uid = currentUser.uid;
        const clearedMap = getClearedNotificationIds(uid);
        const globalNotifRef = ref(db, 'notifications');
        const userNotifRef = ref(db, `users/${uid}/notifications`);
        const [globalSnapshot, userSnapshot] = await Promise.all([
            get(globalNotifRef).catch(() => null),
            get(userNotifRef).catch(() => null)
        ]);

        const allNotifications: any[] = [];
        if (globalSnapshot && globalSnapshot.exists()) {
            globalSnapshot.forEach((child) => {
                const val = child.val();
                const key = child.key || '';
                if (val && key && !clearedMap[key]) {
                    allNotifications.push({ ...val, _key: key, _isUserNotif: false });
                }
            });
        }
        if (userSnapshot && userSnapshot.exists()) {
            userSnapshot.forEach((child) => {
                const val = child.val();
                const key = child.key || '';
                if (val && key && !clearedMap[key]) {
                    allNotifications.push({ ...val, _key: key, _isUserNotif: true });
                }
            });
        }

        currentLoadedNotificationKeys = allNotifications.map(n => n._key);

        if (allNotifications.length === 0) {
            if (emptyMsgEl) emptyMsgEl.style.display = 'block';
            if (elements.clearAllNotificationsBtn) elements.clearAllNotificationsBtn.style.display = 'none';
            return;
        }

        if (elements.clearAllNotificationsBtn) {
            elements.clearAllNotificationsBtn.style.display = 'inline-flex';
        }

        allNotifications.sort((a, b) => (extractNotifTimestamp(b) || 0) - (extractNotifTimestamp(a) || 0));
        let unreadCount = 0;
        const lastChecked = userProfile.lastCheckedNotifications || 0;
        let html = '';

        allNotifications.forEach(notif => {
            const ts = extractNotifTimestamp(notif);
            const isUnread = ts > lastChecked;
            if (isUnread) unreadCount++;
            html += `
                <div class="notification-item" id="notif-item-${notif._key}">
                    ${isUnread ? '<span class="unread-indicator"></span>' : ''}
                    <button type="button" class="notification-delete-btn" data-key="${notif._key}" data-user="${notif._isUserNotif ? '1' : '0'}" title="Delete notification">
                        <i class="bi bi-x-lg"></i>
                    </button>
                    ${notif.imageUrl ? `<img src="${notif.imageUrl}" class="notification-item-img" alt="Notif">` : ''}
                    <div class="notification-item-content">
                        <div class="notification-item-title">${notif.title || 'Notification'}</div>
                        <div class="notification-item-message">${notif.message || notif.body || ''}</div>
                        <div class="notification-item-time"><i class="bi bi-clock"></i> ${formatDate(ts || notif.timestamp)}</div>
                    </div>
                </div>`;
        });

        listEl.innerHTML = html;

        listEl.querySelectorAll('.notification-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e: any) => {
                e.preventDefault();
                e.stopPropagation();
                const key = e.currentTarget.dataset.key;
                const isUser = e.currentTarget.dataset.user === '1';
                if (key) deleteSingleNotification(key, isUser);
            });
        });

        if (unreadCount > 0 && badgeEl) {
            badgeEl.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
            badgeEl.style.display = 'flex';
        }
    } catch (error) {
        console.error("Notifications load error:", error);
    }
}

async function markNotificationsAsRead() {
    if (!currentUser) return;
    try {
        await update(ref(db, `users/${currentUser.uid}`), { lastCheckedNotifications: serverTimestamp() });
        if (elements.notificationBadge) elements.notificationBadge.style.display = 'none';
        elements.notificationsListEl.querySelectorAll('.unread-indicator').forEach(el => el.remove());
    } catch (e) {}
}

function openNotificationsModal() {
    if (!currentUser) return;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        setupPushNotifications(true).catch(() => {});
    }
    elements.notificationsModalInstance?.show();
    markNotificationsAsRead();
}

function handleContactUs() {
    const contactNumber = appSettings.supportContact || '9389660753';
    const userName = userProfile.displayName || "Gamer";
    const message = `Hello Sir, I am ${userName}. I need assistance with the tournament app.`;
    const whatsappUrl = `https://wa.me/${contactNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

async function loadMatchHistory() {
    if (!currentUser || !elements.matchHistoryModalInstance) return;
    elements.matchHistoryBodyEl.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-accent"></div><p class="mt-2 text-secondary">Loading history...</p></div>';
    elements.matchHistoryModalInstance.show();

    try {
        const historyRef = ref(db, `users/${currentUser.uid}/matchHistory`);
        const snapshot = await get(historyRef);

        if (!snapshot.exists()) {
            elements.matchHistoryBodyEl.innerHTML = '<p class="text-center text-secondary p-4">You haven\'t played any completed matches yet.</p>';
            return;
        }

        const sortedHistory = Object.values(snapshot.val()).sort((a: any, b: any) => (b.date || 0) - (a.date || 0));
        let historyHtml = '';
        sortedHistory.forEach((match: any) => {
            historyHtml += `
             <div class="custom-card">
                 <h5 class="tournament-card-title mb-2">${match.tournamentName || 'Tournament'}</h5>
                 <p class="small text-secondary mb-3">${formatFullDateTime(match.date)}</p>
                 <div class="d-flex justify-content-around text-center">
                    <div><span class="text-secondary small d-block">Rank</span><strong class="h5">#${match.rank || 'N/A'}</strong></div>
                    <div><span class="text-secondary small d-block">Kills</span><strong class="h5">${match.kills ?? 'N/A'}</strong></div>
                    <div><span class="text-secondary small d-block">Winnings</span><strong class="h5 text-success">₹${(match.earnings || 0).toFixed(2)}</strong></div>
                 </div>
             </div>`;
        });
        elements.matchHistoryBodyEl.innerHTML = historyHtml;
    } catch (error: any) {
        elements.matchHistoryBodyEl.innerHTML = `<p class="text-center text-danger p-4">Could not load match history.</p>`;
    }
}

function openTournamentChat(tournamentId: string, tournamentName: string) {
    if (!currentUser || !elements.tournamentChatModalInstance) return;
    if (currentChatListener) {
        off(currentChatListener.ref, 'child_added', currentChatListener.func);
        currentChatListener = null;
    }

    elements.tournamentChatModalTitle.textContent = tournamentName;
    elements.chatForm.dataset.tournamentId = tournamentId;
    elements.chatMessagesEl.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-accent"></div></div>';
    elements.tournamentChatModalInstance.show();

    const chatRef = query(ref(db, `chats/${tournamentId}`), limitToLast(50));
    currentChatListener = {
        ref: chatRef,
        func: onChildAdded(chatRef, (snapshot) => {
            if (elements.chatMessagesEl.querySelector('.spinner-border')) {
                elements.chatMessagesEl.innerHTML = '';
            }
            const msg = snapshot.val();
            if (msg) appendChatMessage(msg, true);
        })
    };
}

function appendChatMessage(msg: any, prepend = false) {
    const isMyMessage = msg.uid === currentUser?.uid;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isMyMessage ? 'my-message' : 'other-message'}`;
    bubble.dataset.senderName = msg.displayName;
    bubble.dataset.messageText = msg.message;

    let replyHtml = '';
    if (msg.replyTo) {
        replyHtml = `
            <div class="reply-quote-block">
                <span class="sender-name">${msg.replyTo.originalSenderName}</span>
                <p>${msg.replyTo.originalMessage}</p>
            </div>`;
    }

    bubble.innerHTML = `
        ${replyHtml}
        ${!isMyMessage ? `<span class="sender-name">${msg.displayName || 'User'}</span>` : ''}
        ${msg.message}
        <span class="msg-time">${formatFullDateTime(msg.timestamp)}</span>`;

    if (prepend) elements.chatMessagesEl.prepend(bubble);
    else elements.chatMessagesEl.appendChild(bubble);
}

async function handleChatSubmit(event: any) {
    event.preventDefault();
    const tournamentId = event.currentTarget.dataset.tournamentId;
    const messageText = elements.chatMessageInput.value.trim();
    if (!messageText || !tournamentId || !currentUser) return;

    const messageData: any = {
        uid: currentUser.uid,
        displayName: userProfile.displayName,
        message: messageText,
        timestamp: serverTimestamp()
    };
    if (currentReply) messageData.replyTo = currentReply;

    try {
        await push(ref(db, `chats/${tournamentId}`), messageData);
        elements.chatMessageInput.value = '';
        cancelReply();
    } catch (e) {
        alert("Failed to send message.");
    }
}

function cancelReply() {
    currentReply = null;
    elements.chatReplyContextEl.style.display = 'none';
}

let pendingSelectedAvatarId: string | null = null;
let tempModalSelectedAvatarId: string | null = null;

function convertImageToDataUrlIfNeeded(url: string): Promise<string> {
    if (!url || url.startsWith('https://i.pinimg.com/') || url.startsWith('data:')) {
        return Promise.resolve(url);
    }
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const size = 200;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, size, size);
                    resolve(canvas.toDataURL('image/jpeg', 0.86));
                    return;
                }
            } catch (_) {}
            resolve(url);
        };
        img.onerror = () => resolve(url);
        img.src = url;
    });
}

function renderAvatarPickerGrid() {
    if (!elements.avatarPickerGridEl) return;
    elements.avatarPickerGridEl.innerHTML = AVATAR_COLLECTION.map((av) => {
        const isSelected = tempModalSelectedAvatarId === av.id;
        return `
            <div class="avatar-picker-item position-relative" data-avatar-id="${av.id}" style="width: 84px; height: 84px; border-radius: 50%; cursor: pointer; padding: 3px; border: 2.5px solid ${isSelected ? '#10B981' : 'rgba(255,255,255,0.14)'}; box-shadow: ${isSelected ? '0 0 16px rgba(16, 185, 129, 0.55)' : '0 4px 10px rgba(0,0,0,0.4)'}; transition: all 0.2s ease; background: #0F172A;">
                <img src="${av.url}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" referrerpolicy="no-referrer">
                ${isSelected ? `
                <span style="position: absolute; bottom: -2px; right: -2px; width: 24px; height: 24px; border-radius: 50%; background: #10B981; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; border: 2px solid #0F172A; box-shadow: 0 2px 6px rgba(0,0,0,0.6);">
                    <i class="bi bi-check-lg"></i>
                </span>` : ''}
            </div>
        `;
    }).join('');

    elements.avatarPickerGridEl.querySelectorAll('.avatar-picker-item').forEach((itemEl) => {
        itemEl.addEventListener('click', (e: any) => {
            const clickedId = e.currentTarget.dataset.avatarId;
            if (clickedId) {
                tempModalSelectedAvatarId = clickedId;
                pendingSelectedAvatarId = clickedId;
                const found = AVATAR_COLLECTION.find(a => a.id === clickedId);
                if (found && elements.editProfileAvatarPreviewEl) {
                    elements.editProfileAvatarPreviewEl.src = found.url;
                }
                if (elements.editProfileAvatarSubtextEl) {
                    elements.editProfileAvatarSubtextEl.textContent = 'Avatar selected • Click Save Profile';
                    elements.editProfileAvatarSubtextEl.className = 'text-success fw-semibold d-block';
                }
                renderAvatarPickerGrid();
            }
        });
    });
}

function openChooseAvatarModal() {
    if (!currentUser) return;
    tempModalSelectedAvatarId = pendingSelectedAvatarId || userProfile.avatarId || null;
    if (!tempModalSelectedAvatarId && (userProfile.avatarUrl || userProfile.photoURL)) {
        const curUrl = userProfile.avatarUrl || userProfile.photoURL;
        const matched = AVATAR_COLLECTION.find(a => a.url === curUrl);
        if (matched) tempModalSelectedAvatarId = matched.id;
    }
    renderAvatarPickerGrid();
    elements.chooseAvatarModalInstance?.show();
}

function confirmChooseAvatarSelection() {
    if (tempModalSelectedAvatarId) {
        pendingSelectedAvatarId = tempModalSelectedAvatarId;
        const found = AVATAR_COLLECTION.find(a => a.id === pendingSelectedAvatarId);
        if (found && elements.editProfileAvatarPreviewEl) {
            elements.editProfileAvatarPreviewEl.src = found.url;
        }
        if (elements.editProfileAvatarSubtextEl) {
            elements.editProfileAvatarSubtextEl.textContent = 'Avatar selected • Click Save Profile';
            elements.editProfileAvatarSubtextEl.className = 'text-success fw-semibold d-block';
        }
    }
    elements.chooseAvatarModalInstance?.hide();
}

function openEditNameModal() {
    if (!currentUser) return;
    elements.editNameInput.value = userProfile.displayName || '';
    if (elements.editBioInput) elements.editBioInput.value = userProfile.bio || '';
    if (elements.editFavGunInput) elements.editFavGunInput.value = userProfile.favGun || '';
    if (elements.editInstagramInput) elements.editInstagramInput.value = userProfile.instagram || '';
    if (elements.editYoutubeInput) elements.editYoutubeInput.value = userProfile.youtube || '';

    pendingSelectedAvatarId = userProfile.avatarId || null;
    if (!pendingSelectedAvatarId && (userProfile.avatarUrl || userProfile.photoURL)) {
        const curUrl = userProfile.avatarUrl || userProfile.photoURL;
        const matched = AVATAR_COLLECTION.find(a => a.url === curUrl);
        if (matched) pendingSelectedAvatarId = matched.id;
    }

    const displayName = userProfile.displayName || currentUser.email?.split('@')[0] || 'User';
    const defaultAvatarUrl = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0F172A&color=E2E8F0&bold=true&size=75`;
    if (elements.editProfileAvatarPreviewEl) {
        elements.editProfileAvatarPreviewEl.src = resolveUserAvatarUrl(userProfile, defaultAvatarUrl);
    }
    if (elements.editProfileAvatarSubtextEl) {
        elements.editProfileAvatarSubtextEl.textContent = pendingSelectedAvatarId
            ? 'Custom avatar active • Tap to change'
            : 'Tap to select avatar from collection';
        elements.editProfileAvatarSubtextEl.className = 'text-secondary d-block';
    }

    clearStatusMessage(elements.editNameStatusMessage);
    elements.editNameModalInstance?.show();
}

async function saveNameChange() {
    const newName = elements.editNameInput.value.trim();
    if (!newName) {
        showStatusMessage(elements.editNameStatusMessage, "Display name cannot be empty.", "warning");
        return;
    }
    const newBio = elements.editBioInput ? elements.editBioInput.value.trim() : (userProfile.bio || '');
    const newFavGun = elements.editFavGunInput ? elements.editFavGunInput.value.trim() : (userProfile.favGun || '');
    const newInstagram = elements.editInstagramInput ? elements.editInstagramInput.value.trim() : (userProfile.instagram || '');
    const newYoutube = elements.editYoutubeInput ? elements.editYoutubeInput.value.trim() : (userProfile.youtube || '');

    showLoader(true);
    try {
        const updateData: Record<string, any> = {
            displayName: newName,
            bio: newBio,
            favGun: newFavGun,
            instagram: newInstagram,
            youtube: newYoutube
        };

        if (pendingSelectedAvatarId) {
            const selectedAvatarObj = AVATAR_COLLECTION.find(a => a.id === pendingSelectedAvatarId);
            if (selectedAvatarObj) {
                const portableUrl = await convertImageToDataUrlIfNeeded(selectedAvatarObj.url);
                updateData.avatarId = selectedAvatarObj.id;
                updateData.avatarUrl = portableUrl;
                userProfile.avatarId = selectedAvatarObj.id;
                userProfile.avatarUrl = portableUrl;
            }
        }

        await update(ref(db, `users/${currentUser!.uid}`), updateData);
        userProfile.displayName = newName;
        userProfile.bio = newBio;
        userProfile.favGun = newFavGun;
        userProfile.instagram = newInstagram;
        userProfile.youtube = newYoutube;

        populateUserInfo(currentUser!, userProfile);
        elements.editNameModalInstance?.hide();
    } catch (e: any) {
        showStatusMessage(elements.editNameStatusMessage, e.message, "danger");
    } finally {
        showLoader(false);
    }
}

function initializeEventListeners() {
    elements.bottomNavItems?.forEach(item => item.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(item.dataset.section!);
    }));

    elements.headerBackBtn?.addEventListener('click', () => showSection('home-section'));

    elements.tournamentTabs?.forEach(tab => tab.addEventListener('click', (e: any) => {
        const s = e.currentTarget.dataset.status;
        if (currentTournamentGameId && s) {
            elements.tournamentTabs.forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            filterTournaments(currentTournamentGameId, s);
        }
    }));

    elements.tabSwitchLoginBtn?.addEventListener('click', () => toggleLoginForm(true, true));
    elements.tabSwitchSignupBtn?.addEventListener('click', () => toggleLoginForm(false, true));
    elements.emailLoginForm?.addEventListener('submit', (e) => { e.preventDefault(); loginWithEmail(); });
    elements.emailSignupForm?.addEventListener('submit', (e) => { e.preventDefault(); signUpWithEmail(); });
    elements.loginEmailBtn?.addEventListener('click', (e) => { e.preventDefault(); loginWithEmail(); });
    elements.signupEmailBtn?.addEventListener('click', (e) => { e.preventDefault(); signUpWithEmail(); });
    elements.showSignupToggleBtn?.addEventListener('click', () => toggleLoginForm(false, true));
    elements.showLoginToggleBtn?.addEventListener('click', () => toggleLoginForm(true, true));
    elements.forgotPasswordLink?.addEventListener('click', (e) => { e.preventDefault(); resetPassword(); });
    elements.logoutProfileBtn?.addEventListener('click', logoutUser);

    elements.policyLinks?.forEach(link => link.addEventListener('click', handlePolicyClick));
    elements.withdrawBtn?.addEventListener('click', handleWithdrawClick);
    elements.depositCashAddNowBtn?.addEventListener('click', startRechargeFlow);
    elements.addAmountWalletBtn?.addEventListener('click', startRechargeFlow);
    elements.submitWithdrawRequestBtn?.addEventListener('click', submitWithdrawRequestHandler);

    // Leaderboard Tabs
    elements.tabTopPlayersBtn?.addEventListener('click', () => {
        currentLeaderboardTab = 'players';
        elements.tabTopPlayersBtn.classList.add('active');
        elements.tabTopReferralsBtn.classList.remove('active');
        loadLeaderboardData();
    });

    elements.tabTopReferralsBtn?.addEventListener('click', () => {
        currentLeaderboardTab = 'referrals';
        elements.tabTopReferralsBtn.classList.add('active');
        elements.tabTopPlayersBtn.classList.remove('active');
        loadLeaderboardData();
    });

    // Leaderboard Profile Like
    elements.lbModalLikeBtn?.addEventListener('click', handleLikeProfileClick);

    // Buy Premium Button in Profile
    elements.buyPremiumBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openBuyPremiumModal();
    });
    elements.confirmBuyPremiumBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        confirmBuyPremiumSubscription();
    });

    // Daily Login Mystery Box & Free Fire Rank System Listeners
    elements.openDailyLoginModalBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openDailyLoginRankModal();
    });
    elements.dailyLoginMenuLink?.addEventListener('click', (e) => {
        e.preventDefault();
        openDailyLoginRankModal();
    });
    elements.openAllRanksModalLink?.addEventListener('click', (e) => {
        e.preventDefault();
        openDailyLoginRankModal();
    });
    elements.profileRankEmblemContainer?.addEventListener('click', () => {
        openDailyLoginRankModal();
    });
    elements.claimDailyBoxBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        handleClaimDailyMysteryBox();
    });
    elements.dailyMysteryBoxGraphic?.addEventListener('click', () => {
        handleClaimDailyMysteryBox();
    });
    elements.closeRankUpOverlayBtn?.addEventListener('click', () => {
        elements.ffRankUpCelebrationOverlay?.classList.remove('show-overlay');
    });

    // Redeem Gift Card System Listeners
    elements.redeemGiftCardBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openRedeemGiftCardModal();
    });
    elements.redeemTabBuyBtn?.addEventListener('click', () => switchRedeemTab('buy'));
    elements.redeemTabHistoryBtn?.addEventListener('click', () => switchRedeemTab('history'));
    elements.goToBuyTabBtn?.addEventListener('click', () => switchRedeemTab('buy'));
    elements.brandCardGooglePlay?.addEventListener('click', () => selectRedeemBrand('google_play'));
    elements.brandCardAmazon?.addEventListener('click', () => selectRedeemBrand('amazon'));
    elements.redeemPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.redeemPresetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (elements.redeemCustomAmountInput && btn.dataset.amount) {
                elements.redeemCustomAmountInput.value = btn.dataset.amount;
                updateSubmitRedeemBtnText();
            }
        });
    });
    elements.redeemCustomAmountInput?.addEventListener('input', () => {
        const val = elements.redeemCustomAmountInput.value;
        elements.redeemPresetBtns.forEach(b => {
            if (b.dataset.amount === val) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
        updateSubmitRedeemBtnText();
    });
    elements.submitRedeemBtn?.addEventListener('click', handleConfirmRedeem);
    elements.refreshRedeemHistoryBtn?.addEventListener('click', loadUserRedemptions);

    // Cleanup modal backdrops and restore scroll on any modal dismiss
    document.querySelectorAll('.modal').forEach(modalEl => {
        modalEl.addEventListener('hidden.bs.modal', () => {
            const openModals = document.querySelectorAll('.modal.show');
            if (openModals.length === 0) {
                document.body.classList.remove('modal-open');
                document.body.style.removeProperty('overflow');
                document.body.style.removeProperty('padding-right');
                document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            } else {
                document.body.classList.add('modal-open');
                const backdrops = document.querySelectorAll('.modal-backdrop');
                backdrops.forEach((b, idx) => {
                    if (idx > 0) b.remove();
                });
            }
        });
    });

    // Recharge steps
    elements.rechargePresetBtns.forEach(btn => {
        btn.addEventListener('click', () => { elements.rechargeAmountInput.value = btn.dataset.amount || ''; });
    });
    elements.goToStep2Btn?.addEventListener('click', handleGoToStep2);
    elements.goToStep3Btn?.addEventListener('click', handleGoToStep3);
    elements.paymentOptionCards.forEach(card => {
        card.addEventListener('click', () => {
            elements.paymentOptionCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const radio = card.querySelector<HTMLInputElement>('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });
    elements.rechargeSubmitBtn?.addEventListener('click', submitDepositRequest);
    elements.rechargeCancelBtn?.addEventListener('click', () => showSection('wallet-section'));
    elements.rechargeCopyAmtBtn?.addEventListener('click', () => copyToClipboard(currentRechargeData.amount.toString(), true));
    elements.rechargeCopyUpiBtn?.addEventListener('click', () => copyToClipboard(currentRechargeData.upiId || '', true));

    // Tournament Joining
    elements.confirmJoinBtn?.addEventListener('click', confirmAndJoinTournament);

    // Support Modal
    elements.contactUsBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!currentUser) { alert("Please login first."); return; }
        elements.faqSupportModalInstance?.show();
    });
    elements.whatsappSupportBtn?.addEventListener('click', handleContactUs);

    elements.allTransactionsBtn?.addEventListener('click', () => showSection('earnings-section'));
    elements.viewEarningsHistoryBtn?.addEventListener('click', () => showSection('wallet-section'));
    elements.notificationBtn?.addEventListener('click', openNotificationsModal);
    elements.clearAllNotificationsBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        clearAllNotifications();
    });

    // Profile Notifications Toggle & Permission Request
    elements.notificationSwitch?.addEventListener('change', async (e) => {
        const target = e.target as HTMLInputElement;
        const isTurningOn = target.checked;

        try {
            localStorage.setItem('erena_notifications_enabled', isTurningOn ? 'true' : 'false');
            localStorage.setItem('erena_user_disabled_notifications', isTurningOn ? 'false' : 'true');
        } catch (_) {}

        if (userProfile) {
            userProfile.notificationsEnabled = isTurningOn;
            userProfile.userDisabledNotifications = !isTurningOn;
        }

        if (isTurningOn) {
            target.checked = true;
            if (currentUser) {
                update(ref(db, `users/${currentUser.uid}`), {
                    notificationsEnabled: true,
                    userDisabledNotifications: false
                }).catch(() => {});
                syncServiceWorkerUserState(currentUser.uid, true);
            }

            if ('Notification' in window) {
                try {
                    let perm = Notification.permission;
                    if (perm !== 'granted') {
                        perm = await Notification.requestPermission();
                    }
                    if (perm === 'granted') {
                        await setupPushNotifications(true);
                    }
                } catch (_) {}
            } else {
                await setupPushNotifications(false);
            }

            // Always keep switch ON when user enables it
            target.checked = true;
            triggerSystemNotification("Tournament Notifications Enabled", {
                body: "Background notifications are now active! You will receive tournament and match alerts on your phone."
            });
        } else {
            target.checked = false;
            if (currentUser) {
                update(ref(db, `users/${currentUser.uid}`), {
                    notificationsEnabled: false,
                    userDisabledNotifications: true
                }).catch(() => {});
                syncServiceWorkerUserState(currentUser.uid, false);
            }
        }
    });

    // Promo Link Submit
    elements.submitPromoLinkBtn?.addEventListener('click', async () => {
        if (!currentUser) { alert("Please login first!"); return; }
        const link = elements.promoVideoLink.value.trim();
        if (!link || (!link.includes('youtube.com') && !link.includes('youtu.be'))) {
            showStatusMessage(elements.promoStatusMessage, "Please enter a valid YouTube video link.", "warning");
            return;
        }
        elements.submitPromoLinkBtn.disabled = true;
        try {
            await push(ref(db, 'youtube_promotions'), {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                userName: userProfile.displayName || 'N/A',
                videoLink: link,
                status: 'pending',
                timestamp: serverTimestamp()
            });
            showStatusMessage(elements.promoStatusMessage, "Video link submitted! Rewards will be given after verification.", "success", false);
            elements.promoVideoLink.value = '';
        } catch (e: any) {
            showStatusMessage(elements.promoStatusMessage, "Error: " + e.message, "danger");
        } finally {
            elements.submitPromoLinkBtn.disabled = false;
        }
    });

    elements.editNameBtnEl?.addEventListener('click', openEditNameModal);
    elements.editProfileFullBtn?.addEventListener('click', openEditNameModal);
    elements.openChooseAvatarModalBtn?.addEventListener('click', openChooseAvatarModal);
    elements.confirmChooseAvatarBtnEl?.addEventListener('click', confirmChooseAvatarSelection);
    elements.saveNameChangeBtn?.addEventListener('click', saveNameChange);
    elements.matchHistoryBtn?.addEventListener('click', (e) => { e.preventDefault(); loadMatchHistory(); });
    elements.chatForm?.addEventListener('submit', handleChatSubmit);
    elements.cancelReplyBtn?.addEventListener('click', cancelReply);

    // Prevent any <a href="#"> from triggering iframe navigation
    document.addEventListener('click', (e: any) => {
        const anchor = e.target?.closest?.('a[href="#"]');
        if (anchor) {
            e.preventDefault();
        }
    });

    // Friend System Menus & Cross Navigation
    elements.messagesMenuBtn?.addEventListener('click', (e) => { e.preventDefault(); showSection('messages-section'); });
    elements.friendsMenuBtn?.addEventListener('click', (e) => { e.preventDefault(); showSection('friends-section'); });
    elements.friendRequestsMenuBtn?.addEventListener('click', (e) => { e.preventDefault(); showSection('friend-requests-section'); });
    elements.messagesGoToFriendsBtn?.addEventListener('click', () => showSection('friends-section'));
    elements.friendsGoToRequestsBtn?.addEventListener('click', () => showSection('friend-requests-section'));
    elements.requestsGoToFriendsBtn?.addEventListener('click', () => showSection('friends-section'));
    elements.conversationsFindFriendsBtn?.addEventListener('click', () => showSection('friends-section'));
    elements.friendsBrowseLeaderboardBtn?.addEventListener('click', () => showSection('leaderboard-section'));

    // Friends & Conversations Search Filters
    elements.conversationsSearchInput?.addEventListener('input', (e: any) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderConversationsList(currentConversationsCache);
            return;
        }
        const filtered = currentConversationsCache.filter(c => (c.friendName || '').toLowerCase().includes(query) || (c.lastMessage || '').toLowerCase().includes(query));
        renderConversationsList(filtered);
    });

    elements.friendsSearchInput?.addEventListener('input', (e: any) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderFriendsList(currentFriendsCache);
            return;
        }
        const filtered = currentFriendsCache.filter(f => (f.displayName || '').toLowerCase().includes(query));
        renderFriendsList(filtered);
    });

    // Personal Chat Full-Screen Controls & Navigation
    elements.personalChatBackBtn?.addEventListener('click', closePersonalChat);
    elements.personalChatForm?.addEventListener('submit', handlePersonalChatSubmit);
    elements.personalChatViewProfileBtn?.addEventListener('click', () => {
        if (activePersonalChatFriend) (window as any).viewPlayerProfile(activePersonalChatFriend.uid);
    });
    elements.personalChatMenuProfile?.addEventListener('click', () => {
        if (activePersonalChatFriend) (window as any).viewPlayerProfile(activePersonalChatFriend.uid);
    });
    elements.personalChatMenuClear?.addEventListener('click', (e) => {
        e.preventDefault();
        clearPersonalChat();
    });
    elements.personalChatMenuUnfriend?.addEventListener('click', () => {
        if (activePersonalChatFriend) removeFriend(activePersonalChatFriend.uid);
    });
    elements.personalChatMenuBlock?.addEventListener('click', () => {
        if (activePersonalChatFriend) toggleBlockUser(activePersonalChatFriend.uid);
    });
    elements.unblockUserBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        if (activePersonalChatFriend) toggleBlockUser(activePersonalChatFriend.uid);
    });

    // Live typing status detection in Personal Chat
    elements.personalChatInput?.addEventListener('input', () => {
        if (!currentUser || !activePersonalChatFriend) return;
        set(ref(db, `users/${currentUser.uid}/isTypingTo`), activePersonalChatFriend.uid).catch(() => {});
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            if (currentUser) {
                set(ref(db, `users/${currentUser.uid}/isTypingTo`), null).catch(() => {});
            }
        }, 2500);
    });

    // Hardware/System back button listener for Personal Chat
    window.addEventListener('popstate', () => {
        if (elements.personalChatSection && elements.personalChatSection.style.display === 'flex') {
            actuallyClosePersonalChat();
        }
    });

    // Copy buttons delegation
    document.body.addEventListener('click', (event: any) => {
        if (event.target.matches('.copy-btn') || event.target.closest('.copy-btn')) {
            const btn = event.target.closest('.copy-btn');
            const targetSelector = btn.dataset.target;
            if (targetSelector) copyToClipboard(targetSelector);
        }
        if (event.target.matches('#shareReferralBtn') || event.target.closest('#shareReferralBtn')) {
            const cel = getElement('referralCodeDisplay');
            if (cel) shareReferral(cel.textContent || '');
        }
    });

    // Sound effects
    initializeAudio();
}

function initializeAudio() {
    const backgroundMusic = document.getElementById('backgroundMusic') as HTMLAudioElement;
    const clickSound = document.getElementById('clickSound') as HTMLAudioElement;

    if (backgroundMusic && clickSound) {
        backgroundMusic.volume = 0.2;
        clickSound.volume = 0.3;

        const startAudio = () => {
            backgroundMusic.play().catch(() => {});
            document.removeEventListener('click', startAudio);
            document.removeEventListener('touchstart', startAudio);
        };
        document.addEventListener('click', startAudio, { once: true });
        document.addEventListener('touchstart', startAudio, { once: true });

        document.body.addEventListener('click', (event: any) => {
            if (event.target.closest('button, a, .game-card, .interactive-list-item')) {
                clickSound.currentTime = 0;
                clickSound.play().catch(() => {});
            }
        });
    }
}

// App Initialization on DOM Ready
function startApp() {
    console.log("DOM ready. Initializing tournament platform...");
    // Initialize background messaging service worker early
    initFirebaseMessaging().catch(err => console.warn("[FCM] Early SW init error:", err));

    // Automatically trigger notification permission prompt on app open / APK install
    const triggerPermissionPromptOnLaunch = () => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                setupPushNotifications(true).catch(() => {});
            } else if (Notification.permission === 'granted') {
                setupPushNotifications(false).catch(() => {});
            }
        }
    };

    triggerPermissionPromptOnLaunch();
    window.addEventListener('click', triggerPermissionPromptOnLaunch, { once: true });
    window.addEventListener('touchend', triggerPermissionPromptOnLaunch, { once: true });

    showLoader(true);
    appSettings = { ...DEFAULT_APP_SETTINGS };
    initializeEventListeners();
    updateGlobalUI(false);
    onAuthStateChanged(auth, handleAuthStateChange);
    loadAppSettings().catch(() => {});
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
