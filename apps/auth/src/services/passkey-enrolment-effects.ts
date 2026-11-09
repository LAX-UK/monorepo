import type { SecurityNoticePublisher } from "@auction/auth";
import type { IdentityOperationsService } from "./identity-operations.service.js";

/**
 * What follows a passkey being made: the audit event, and the one security email (SM9). The
 * passkey is already stored when this runs, so a failure here is retried by the caller and never
 * undoes it, and the email never throws.
 */
export class PasskeyEnrolmentEffects {
  constructor(
    private readonly ports: {
      operations: Pick<IdentityOperationsService, "recordPasskeyAdded">;
      notices: SecurityNoticePublisher;
    },
    private readonly now: () => Date = () => new Date(),
  ) {}

  async registered(input: {
    userId: string;
    /** The name the person (or the suggestion) gave it; the email names it. */
    name: string | null;
    userAgent: string | null;
  }): Promise<void> {
    await this.ports.operations.recordPasskeyAdded(input.userId);
    void this.ports.notices.notify({
      kind: "sign_in_method_added",
      userId: input.userId,
      at: this.now(),
      method: "passkey",
      detail: input.name,
      userAgent: input.userAgent,
    });
  }
}
