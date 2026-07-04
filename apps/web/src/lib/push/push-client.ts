import { getNotificationPermission, isPushSupported } from "@/lib/push/capability";
import {
  fetchPushSubscriptionStatus,
  fetchPushVapidPublicKey,
  removePushSubscriptionOnServer,
  savePushSubscriptionOnServer,
} from "@/lib/push/push-subscription.client";
import { urlBase64ToUint8Array } from "@/lib/push/url-base64";

export type PushServerStatus = {
  hasServerSubscription: boolean;
};

export type PushClientSnapshot = {
  supported: boolean;
  permission: ReturnType<typeof getNotificationPermission>;
  hasBrowserSubscription: boolean;
  hasServerSubscription: boolean;
};

export interface PushClient {
  registerServiceWorker(): Promise<ServiceWorkerRegistration>;
  getBrowserSubscription(): Promise<PushSubscription | null>;
  getServerStatus(): Promise<PushServerStatus>;
  fetchVapidPublicKey(): Promise<string | null>;
  subscribe(vapidPublicKey: string): Promise<void>;
  unsubscribe(): Promise<void>;
  sync(vapidPublicKey: string): Promise<void>;
  getSnapshot(): Promise<PushClientSnapshot>;
}

const SW_PATH = "/sw.js";
const SW_OPTIONS: RegistrationOptions = { scope: "/", updateViaCache: "none" };

export function createWebPushClient(): PushClient {
  return {
    async registerServiceWorker() {
      if (!isPushSupported()) {
        throw new Error("Push notifications are not supported in this browser.");
      }
      return navigator.serviceWorker.register(SW_PATH, SW_OPTIONS);
    },

    async getBrowserSubscription() {
      if (!isPushSupported()) return null;
      const reg = await navigator.serviceWorker.ready;
      return reg.pushManager.getSubscription();
    },

    async getServerStatus() {
      return fetchPushSubscriptionStatus();
    },

    async fetchVapidPublicKey() {
      return fetchPushVapidPublicKey();
    },

    async subscribe(vapidPublicKey) {
      if (!isPushSupported()) {
        throw new Error("Push notifications are not supported in this browser.");
      }
      const reg = await this.registerServiceWorker();
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        throw new Error("Notification permission was not granted.");
      }
      const keyBytes = urlBase64ToUint8Array(vapidPublicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer.slice(
          keyBytes.byteOffset,
          keyBytes.byteOffset + keyBytes.byteLength,
        ) as ArrayBuffer,
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Invalid push subscription.");
      }
      await savePushSubscriptionOnServer({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
    },

    async unsubscribe() {
      const sub = await this.getBrowserSubscription();
      if (!sub) return;
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      try {
        await removePushSubscriptionOnServer(endpoint);
      } catch {
        // Browser is already unsubscribed; server 410 cleanup handles stale rows on next send.
      }
    },

    async sync(_vapidPublicKey) {
      if (getNotificationPermission() !== "granted") return;
      const reg = await this.registerServiceWorker();
      const sub = await reg.pushManager.getSubscription();
      // Never auto-subscribe here — browsers require a user gesture for new subscriptions.
      if (!sub) return;
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
      await savePushSubscriptionOnServer({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
    },

    async getSnapshot() {
      const supported = isPushSupported();
      const permission = getNotificationPermission();
      let hasBrowserSubscription = false;
      let hasServerSubscription = false;
      if (supported) {
        try {
          const sub = await this.getBrowserSubscription();
          hasBrowserSubscription = sub !== null;
        } catch {
          hasBrowserSubscription = false;
        }
      }
      try {
        const server = await this.getServerStatus();
        hasServerSubscription = server.hasServerSubscription;
      } catch {
        hasServerSubscription = false;
      }
      return { supported, permission, hasBrowserSubscription, hasServerSubscription };
    },
  };
}

let defaultClient: PushClient | null = null;

export function getPushClient(): PushClient {
  if (!defaultClient) {
    defaultClient = createWebPushClient();
  }
  return defaultClient;
}
