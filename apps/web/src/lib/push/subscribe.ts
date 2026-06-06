import { getPushClient } from "@/lib/push/push-client";

export { urlBase64ToUint8Array } from "@/lib/push/url-base64";

export async function registerPushSubscription(vapidPublicKey: string): Promise<void> {
  await getPushClient().subscribe(vapidPublicKey);
}

export async function unregisterPushSubscription(): Promise<void> {
  await getPushClient().unsubscribe();
}

export async function syncPushSubscription(vapidPublicKey: string): Promise<void> {
  await getPushClient().sync(vapidPublicKey);
}
