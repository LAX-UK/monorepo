import { pushApiBase } from "@/lib/push/api-base";

export type PushServerStatus = {
  hasServerSubscription: boolean;
};

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** POST /users/me/push-subscription */
export async function savePushSubscriptionOnServer(sub: PushSubscriptionPayload): Promise<void> {
  const res = await fetch(`${pushApiBase()}/users/me/push-subscription`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
  });
  if (!res.ok) {
    throw new Error("Failed to save subscription on server.");
  }
}

/** POST /users/me/push-subscription/remove */
export async function removePushSubscriptionOnServer(endpoint: string): Promise<void> {
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

/** GET /users/me/push-subscription/status */
export async function fetchPushSubscriptionStatus(): Promise<PushServerStatus> {
  const res = await fetch(`${pushApiBase()}/users/me/push-subscription/status`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Failed to load push subscription status.");
  }
  const body = (await res.json()) as { data?: PushServerStatus };
  return body.data ?? { hasServerSubscription: false };
}

/** GET /users/me/push/vapid-key */
export async function fetchPushVapidPublicKey(): Promise<string | null> {
  const res = await fetch(`${pushApiBase()}/users/me/push/vapid-key`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { publicKey?: string | null } };
  return body.data?.publicKey ?? null;
}
