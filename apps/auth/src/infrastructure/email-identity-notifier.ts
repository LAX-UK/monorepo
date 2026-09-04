import type { EmailSender } from "@auction/auth";
import type { IIdentityNotifier } from "../services/identity-notification.ports.js";

export class EmailIdentityNotifier implements IIdentityNotifier {
  constructor(private readonly email: EmailSender) {}

  async passwordChanged(input: {
    to: string;
    subjectId: string;
    userName: string;
  }): Promise<void> {
    await this.email.enqueue({
      template: "password-changed",
      to: input.to,
      userId: input.subjectId,
      category: "auth",
      vars: { userName: input.userName },
    });
  }
}
