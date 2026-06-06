import { pushApiBase } from "@/lib/push/api-base";
import { getNotificationPermission, isPushSupported } from "@/lib/push/capability";
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

async function saveSubscriptionOnServer(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Invalid push subscription.");
  }
  const res = await fetch(`${pushApiBase()}/users/me/push-subscription`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  });
  if (!res.ok) {
    throw new Error("Failed to save subscription on server.");
  }
}

async function removeSubscriptionOnServer(endpoint: string): Promise<void> {
  const res = await fetch(`${pushApiBase()}/users/me/push-subscription/remove`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) {
    throw new Error("Failed to remove subscription on server.");
  }
}

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
      const res = await fetch(`${pushApiBase()}/users/me/push-subscription/status`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load push subscription status.");
      }
      const body = (await res.json()) as { data?: PushServerStatus };
      return body.data ?? { hasServerSubscription: false };
    },

    async fetchVapidPublicKey() {
      const res = await fetch(`${pushApiBase()}/users/me/push/vapid-key`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: { publicKey?: string | null } };
      return body.data?.publicKey ?? null;
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
      await saveSubscriptionOnServer(sub);
    },

    async unsubscribe() {
      const sub = await this.getBrowserSubscription();
      if (!sub) return;
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      try {
        await removeSubscriptionOnServer(endpoint);
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
      await saveSubscriptionOnServer(sub);
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
