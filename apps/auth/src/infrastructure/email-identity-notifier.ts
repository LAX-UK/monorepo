import type { SecurityNoticePublisher } from "@auction/auth";
import type { IIdentityNotifier } from "../services/identity-notification.ports.js";

/** Sends the identity operations' notices as LAX Account security emails. */
export class EmailIdentityNotifier implements IIdentityNotifier {
  constructor(private readonly notices: SecurityNoticePublisher) {}

  async passwordChanged(input: { subjectId: string }): Promise<void> {
    await this.notices.notify({
      kind: "password_changed",
      userId: input.subjectId,
      at: new Date(),
    });
  }
}
