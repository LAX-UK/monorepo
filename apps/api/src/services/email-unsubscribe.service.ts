import type { Database } from "@auction/db";
import { emailSuppression } from "@auction/db/schema";
import { emailHash } from "@auction/email";
import type { Env } from "../env.js";
import { verifyUnsubscribeToken } from "../lib/email-unsubscribe-token.js";
import { emailPreferenceKey } from "../lib/notification-preference-keys.js";
import type { NotificationPreferenceInput } from "./interfaces/notification-preference.js";
import type { INotificationPreferenceRepository } from "./interfaces/notification-preference.js";
import type { IUserRepository } from "./interfaces/repositories.js";

export class EmailUnsubscribeService {
  constructor(
    private readonly db: Database,
    private readonly env: Env,
    private readonly users: IUserRepository,
    private readonly notificationPreferences: INotificationPreferenceRepository,
  ) {}

  async applyToken(token: string): Promise<void> {
    const payload = verifyUnsubscribeToken(token, this.env.EMAIL_UNSUBSCRIBE_SECRET);
    const user = await this.users.findById(payload.userId);
    if (!user) throw new Error("User not found");

    if (payload.scope === "global") {
      await this.db
        .insert(emailSuppression)
        .values({ emailHash: emailHash(user.email), reason: "unsubscribe" })
        .onConflictDoUpdate({
          target: emailSuppression.emailHash,
          set: { reason: "unsubscribe", createdAt: new Date() },
        });
      return;
    }

    const key = emailPreferenceKey(payload.notificationType);
    if (!key) throw new Error("Unsupported notification type");
    await this.notificationPreferences.upsert(payload.userId, {
      [key]: false,
    } as Partial<NotificationPreferenceInput>);
  }
}
