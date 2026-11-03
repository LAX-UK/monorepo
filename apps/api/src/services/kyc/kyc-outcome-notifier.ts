import type { IEmailService } from "@auction/email";
import type {
  INotificationWriteRepository,
  IUserRepository,
} from "@auction/persistence/interfaces";
import type { INotificationFactory } from "../interfaces/notification-factory.js";

export type KycOutcome = "approved" | "declined";

/**
 * Tells a person the result of their identity check, by email and in the app. The wording never
 * carries a reason from the verification provider.
 */
export class KycOutcomeNotifier {
  constructor(
    private readonly users: IUserRepository,
    private readonly email: IEmailService,
    private readonly notifications: INotificationWriteRepository,
    private readonly factory: Pick<INotificationFactory, "createKycApproved" | "createKycDeclined">,
    private readonly webOrigin: string,
  ) {}

  /** `decisionKey` identifies the decision, so a repeated webhook sends nothing twice. */
  async notify(userId: string, outcome: KycOutcome, decisionKey: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user?.email) return;

    const origin = this.webOrigin.replace(/\/$/, "");
    const idempotencyKey = `kyc-${outcome}:${userId}:${decisionKey}`;
    if (outcome === "approved") {
      await this.email.enqueue({
        template: "kyc-approved",
        to: user.email,
        userId,
        category: "transactional",
        vars: { userName: user.name, registerUrl: `${origin}/sales` },
        idempotencyKey,
      });
      await this.notifications.createMany([this.factory.createKycApproved(userId)]);
      return;
    }
    await this.email.enqueue({
      template: "kyc-declined",
      to: user.email,
      userId,
      category: "transactional",
      vars: {
        userName: user.name,
        retryUrl: `${origin}/verify-identity`,
        contactUrl: `${origin}/contact`,
      },
      idempotencyKey,
    });
    await this.notifications.createMany([this.factory.createKycDeclined(userId)]);
  }
}
