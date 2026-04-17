import type { IPushSender } from "../services/interfaces/push.js";

/** Used when VAPID keys are not configured. */
export class NoOpPushSender implements IPushSender {
  async send(): Promise<boolean> {
    return true;
  }
}
