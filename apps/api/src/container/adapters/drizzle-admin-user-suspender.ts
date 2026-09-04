import type { Database } from "@auction/db";
import { bidIdentityDirectory } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { writeBidUserProfile } from "@auction/persistence/bid-user-profile-sync";
import type { IAdminUserSuspender } from "@auction/persistence/interfaces";
import { eq } from "drizzle-orm";
import type { IAuthAuditPublisher } from "../../services/interfaces/auth-audit-publisher.js";

export class DrizzleAdminUserSuspender implements IAdminUserSuspender {
  constructor(
    private readonly db: Database,
    private readonly hooks?: {
      authAudit?: IAuthAuditPublisher;
      emailService?: IEmailService;
      accountSuspendedSupportEmail?: string;
    },
  ) {}

  async suspend(userId: string, reason: string | null): Promise<void> {
    const [before] = await this.db
      .select({ email: bidIdentityDirectory.email, name: bidIdentityDirectory.name })
      .from(bidIdentityDirectory)
      .where(eq(bidIdentityDirectory.subjectId, userId))
      .limit(1);

    await writeBidUserProfile(this.db, userId, {
      suspendedAt: new Date(),
      suspendedReason: reason,
    });

    void this.hooks?.authAudit
      ?.publish({
        eventType: "bid.user_suspended",
        aggregateId: userId,
        payload: {},
        actorUserId: null,
      })
      .catch(() => {});

    if (before?.email && this.hooks?.emailService) {
      void this.hooks.emailService.enqueue({
        template: "account-suspended",
        to: before.email,
        userId,
        category: "auth",
        vars: {
          userName: before.name,
          supportContactEmail: this.hooks?.accountSuspendedSupportEmail ?? "support@lax.bid",
        },
      });
    }
  }

  async unsuspend(userId: string): Promise<void> {
    await writeBidUserProfile(this.db, userId, {
      suspendedAt: null,
      suspendedReason: null,
    });
  }
}
