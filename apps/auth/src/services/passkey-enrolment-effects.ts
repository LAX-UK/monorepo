import type { SecurityNoticePublisher } from "@auction/auth";

/**
 * What follows a passkey being made: the one security email (SM9). The passkey and its "added"
 * audit event are already stored together, in one transaction, so a failure here is only about the
 * email, which never throws and never undoes the passkey.
 */
export class PasskeyEnrolmentEffects {
  constructor(
    private readonly ports: { notices: SecurityNoticePublisher },
    private readonly now: () => Date = () => new Date(),
  ) {}

  async registered(input: {
    userId: string;
    /** The name the person (or the suggestion) gave it; the email names it. */
    name: string | null;
    userAgent: string | null;
  }): Promise<void> {
    await this.ports.notices.notify({
      kind: "sign_in_method_added",
      userId: input.userId,
      at: this.now(),
      method: "passkey",
      detail: input.name,
      userAgent: input.userAgent,
    });
  }
}
