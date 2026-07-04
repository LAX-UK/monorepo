import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import type { IAdminUserSuspender } from "@auction/persistence";
import { eq } from "drizzle-orm";
import type { IAuthAuditPublisher } from "../../services/interfaces/auth-audit-publisher.js";

export class DrizzleAdminUserSuspender implements IAdminUserSuspender {
  constructor(
    private readonly db: Database,
    private readonly sessions: { revokeAllForUser: (userId: string) => Promise<unknown> },
    private readonly hooks?: {
      authAudit?: IAuthAuditPublisher;
      emailService?: IEmailService;
      accountSuspendedSupportEmail?: string;
    },
  ) {}

  async suspend(userId: string, reason: string | null): Promise<void> {
    const [before] = await this.db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    await this.db
      .update(user)
      .set({
        suspendedAt: new Date(),
        suspendedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
    await this.sessions.revokeAllForUser(userId);

    void this.hooks?.authAudit
      ?.publish({
        eventType: "auth.account_suspended",
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
    await this.db
      .update(user)
      .set({
        suspendedAt: null,
        suspendedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  }
}
