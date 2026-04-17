import webpush from "web-push";
import type { IPushSender, PushPayload } from "../services/interfaces/push.js";

export class WebPushSender implements IPushSender {
  constructor(vapidPublicKey: string, vapidPrivateKey: string, vapidSubject: string) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  }

  async send(
    endpoint: string,
    p256dh: string,
    auth: string,
    payload: PushPayload,
  ): Promise<boolean> {
    try {
      await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, JSON.stringify(payload));
      return true;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 410) return false;
      throw err;
    }
  }
}
