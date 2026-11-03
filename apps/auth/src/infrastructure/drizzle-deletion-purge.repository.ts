import type { IdentityEventPublisher } from "@auction/auth";
import type { DeletionBlocker } from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import { user } from "@auction/identity-db/schema";
import { and, asc, eq, gt, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type {
  DeletionPurgeRepository,
  DueCursor,
  DueSubject,
  HoldOutcome,
} from "../services/identity-deletion-purge.ports.js";

/** The anonymised address the scrub leaves behind; a person with it is already erased. */
const PURGED_EMAIL = sql`'deleted+' || ${user.id} || '@purged.invalid'`;

/** The same list in a fixed key order; jsonb does not keep the order the keys were written in. */
function canonical(reasons: unknown): string {
  const list = Array.isArray(reasons) ? (reasons as DeletionBlocker[]) : [];
  return JSON.stringify(
    list.map((reason) => ({ code: reason.code, message: reason.message, href: reason.href })),
  );
}

function sameReasons(stored: unknown, next: readonly DeletionBlocker[]): boolean {
  return canonical(stored) === canonical(next);
}

export class DrizzleDeletionPurgeRepository implements DeletionPurgeRepository {
  constructor(
    private readonly db: IdentityDatabase,
    private readonly events: IdentityEventPublisher,
  ) {}

  async listDue(input: {
    cutoff: Date;
    after: DueCursor | null;
    limit: number;
  }): Promise<DueSubject[]> {
    const afterCursor = input.after
      ? or(
          gt(user.deletionRequestedAt, input.after.requestedAt),
          and(eq(user.deletionRequestedAt, input.after.requestedAt), gt(user.id, input.after.id)),
        )
      : undefined;
    const rows = await this.db
      .select({ id: user.id, requestedAt: user.deletionRequestedAt })
      .from(user)
      .where(
        and(
          isNotNull(user.deletionRequestedAt),
          lt(user.deletionRequestedAt, input.cutoff),
          sql`${user.email} <> ${PURGED_EMAIL}`,
          afterCursor,
        ),
      )
      .orderBy(asc(user.deletionRequestedAt), asc(user.id))
      .limit(input.limit);
    return rows.flatMap((row) =>
      row.requestedAt ? [{ id: row.id, requestedAt: row.requestedAt }] : [],
    );
  }

  recordHold(input: {
    subjectId: string;
    reasons: readonly DeletionBlocker[];
    now: Date;
  }): Promise<HoldOutcome> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          requestedAt: user.deletionRequestedAt,
          heldAt: user.deletionHeldAt,
          reasons: user.deletionHoldReasons,
        })
        .from(user)
        .where(eq(user.id, input.subjectId))
        .limit(1)
        .for("update");
      if (!current?.requestedAt) return "gone";
      if (current.heldAt && sameReasons(current.reasons, input.reasons)) return "unchanged";
      const heldAt = current.heldAt ?? input.now;
      await tx
        .update(user)
        .set({ deletionHeldAt: heldAt, deletionHoldReasons: [...input.reasons] })
        .where(eq(user.id, input.subjectId));
      await this.events.publish(
        { type: "user.deletion_held", userId: input.subjectId, heldAt, reasons: input.reasons },
        { producer: "apps/auth-deletion-purge", transaction: tx },
      );
      return current.heldAt ? "changed" : "new";
    });
  }

  purge(input: { subjectId: string; cutoff: Date; now: Date }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ email: user.email })
        .from(user)
        .where(
          and(
            eq(user.id, input.subjectId),
            isNotNull(user.deletionRequestedAt),
            lt(user.deletionRequestedAt, input.cutoff),
            sql`${user.email} <> ${PURGED_EMAIL}`,
          ),
        )
        .limit(1)
        .for("update");
      if (!current) return false;
      // The confirmation needs an address, and the scrub removes it. Copy it into the durable
      // outbox first, in this transaction, so it exists exactly when the erasure does. The row
      // is deleted once the message is sent.
      await tx.execute(sql`
        INSERT INTO auth_security_effect_outbox (kind, payload, user_id, status, attempt_count, next_attempt_at)
        VALUES (
          'send_account_deleted_notice',
          ${JSON.stringify({
            kind: "send_account_deleted_notice",
            userId: input.subjectId,
            email: current.email,
            erasedAt: input.now.toISOString(),
          })}::jsonb,
          ${input.subjectId},
          'pending',
          0,
          ${input.now}
        )
      `);
      await tx.execute(sql`SELECT user_pii_purge(${input.subjectId})`);
      await tx
        .update(user)
        .set({ deletionHeldAt: null, deletionHoldReasons: null })
        .where(eq(user.id, input.subjectId));
      await this.events.publish(
        { type: "user.identity_deleted", userId: input.subjectId },
        { producer: "apps/auth-deletion-purge", transaction: tx },
      );
      return true;
    });
  }

  claimReminders(input: {
    now: Date;
    cutoff: Date;
    remindBefore: Date;
    limit: number;
  }): Promise<DueSubject[]> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: user.id, requestedAt: user.deletionRequestedAt })
        .from(user)
        .where(
          and(
            isNotNull(user.deletionRequestedAt),
            lt(user.deletionRequestedAt, input.remindBefore),
            // Not yet due: people who are due are handled by the purge itself.
            sql`${user.deletionRequestedAt} >= ${input.cutoff}`,
            isNull(user.deletionHeldAt),
            isNull(user.deletionReminderSentAt),
          ),
        )
        .orderBy(asc(user.deletionRequestedAt), asc(user.id))
        .limit(input.limit)
        .for("update", { skipLocked: true });
      const claimed = rows.flatMap((row) =>
        row.requestedAt ? [{ id: row.id, requestedAt: row.requestedAt }] : [],
      );
      for (const subject of claimed) {
        await tx
          .update(user)
          .set({ deletionReminderSentAt: input.now })
          .where(eq(user.id, subject.id));
      }
      return claimed;
    });
  }
}
