import { emailHash } from "@auction/email";
import type { IEmailSuppressionRepository } from "@auction/persistence/interfaces";
import type { NotificationPreferenceInput } from "@auction/persistence/interfaces";
import type { INotificationPreferenceRepository } from "@auction/persistence/interfaces";
import type { IUserRepository } from "@auction/persistence/interfaces";
import { emailPreferenceKey } from "@auction/persistence/lib";
import type { Env } from "../env.js";
import { verifyUnsubscribeToken } from "../lib/email-unsubscribe-token.js";

export class EmailUnsubscribeService {
  constructor(
    private readonly emailSuppressions: IEmailSuppressionRepository,
    private readonly env: Env,
    private readonly users: IUserRepository,
    private readonly notificationPreferences: INotificationPreferenceRepository,
  ) {}

  async applyToken(token: string): Promise<void> {
    const payload = verifyUnsubscribeToken(token, this.env.EMAIL_UNSUBSCRIBE_SECRET);
    const user = await this.users.findById(payload.userId);
    if (!user) throw new Error("User not found");

    if (payload.scope === "global") {
      await this.emailSuppressions.upsert(emailHash(user.email), "unsubscribe");
      return;
    }

    const key = emailPreferenceKey(payload.notificationType);
    if (!key) throw new Error("Unsupported notification type");
    await this.notificationPreferences.upsert(payload.userId, {
      [key]: false,
    } as Partial<NotificationPreferenceInput>);
  }
}
