import type { Database } from "@auction/db";
import { marketingContactSyncLog, user } from "@auction/db/schema";
import type { MarketingContactSyncStatus } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type pino from "pino";
import {
  isEmailSuppressed,
  marketingContactSkipReason,
} from "../lib/marketing-contact-sync/eligibility.js";
import type {
  IMarketingContactSync,
  MarketingContact,
  SyncResult,
} from "../lib/marketing-contact-sync/index.js";

export type MarketingContactSyncJobData = {
  userId: string;
  /** Why this sync was enqueued (projector reason). */
  reason: string;
};

type AuditInput = {
  userId: string;
  provider: string;
  action: string;
  status: MarketingContactSyncStatus;
  reason: string;
  providerContactId?: string | null;
  responseCode?: number | null;
  error?: string | null;
};

/**
 * Sync a single registered user into the marketing ESP.
 *
 * Always reads the live `user` row (never trusts the event-payload snapshot for
 * mutable fields). Honors GDPR deletion (archive), the suppression list, and the
 * eligibility rules. Writes one audit row per attempt. Throws only when the
 * provider error is retryable, so BullMQ retries transient failures and leaves
 * terminal 4xx rejections as a recorded no-retry outcome.
 */
export async function marketingContactSyncJob({
  db,
  sync,
  log,
  data,
}: {
  db: Database;
  sync: IMarketingContactSync;
  log: pino.Logger;
  data: MarketingContactSyncJobData;
}): Promise<void> {
  const [row] = await db
    .select({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      country: user.mobileCountry,
      kycStatus: user.kycStatus,
      signupPersona: user.signupPersona,
      emailStatus: user.emailStatus,
      suspendedAt: user.suspendedAt,
      deletionRequestedAt: user.deletionRequestedAt,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, data.userId))
    .limit(1);

  if (!row) {
    log.warn({ userId: data.userId, reason: data.reason }, "marketing_contact_sync_user_missing");
    return;
  }

  // GDPR erasure: archive the contact in the ESP rather than continuing to sync it.
  if (row.deletionRequestedAt) {
    const result = await sync.archiveContact(row.email);
    await writeAudit(db, log, resultToAudit(result, sync.provider, row.id, data.reason, "archive"));
    throwIfRetryable(result, "archive");
    return;
  }

  const suppressed = await isEmailSuppressed(db, row.email);
  const skip = marketingContactSkipReason(row, suppressed);
  if (skip) {
    await writeAudit(db, log, {
      userId: row.id,
      provider: sync.provider,
      action: "skipped",
      status: "skipped",
      reason: `${data.reason}:${skip}`,
    });
    return;
  }

  const contact: MarketingContact = {
    userId: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    country: row.country,
    role: row.role,
    kycStatus: row.kycStatus,
    emailVerified: row.emailVerified,
    signupSource: row.signupPersona,
    createdAt: row.createdAt,
  };

  const result = await sync.upsertContact(contact);
  await writeAudit(db, log, resultToAudit(result, sync.provider, row.id, data.reason, "upsert"));
  throwIfRetryable(result, "upsert");
}

function resultToAudit(
  result: SyncResult,
  provider: string,
  userId: string,
  reason: string,
  attemptedAction: "upsert" | "archive",
): AuditInput {
  if (result.ok) {
    return {
      userId,
      provider,
      action: result.action,
      status: result.action === "archive" ? "archived" : "synced",
      reason,
      providerContactId: result.providerContactId ?? null,
    };
  }
  return {
    userId,
    provider,
    action: attemptedAction,
    status: result.retryable ? "failed" : "rejected",
    reason,
    responseCode: result.code ?? null,
    error: result.message,
  };
}

function throwIfRetryable(result: SyncResult, action: string): void {
  if (!result.ok && result.retryable) {
    throw new Error(`marketing contact ${action} failed (retryable): ${result.message}`);
  }
}

async function writeAudit(db: Database, log: pino.Logger, input: AuditInput): Promise<void> {
  try {
    await db.insert(marketingContactSyncLog).values({
      userId: input.userId,
      provider: input.provider,
      action: input.action,
      status: input.status,
      reason: input.reason,
      providerContactId: input.providerContactId ?? null,
      responseCode: input.responseCode ?? null,
      error: input.error ?? null,
    });
  } catch (err) {
    // Audit logging must never mask the sync outcome (retry decision).
    log.error({ err, userId: input.userId }, "marketing_contact_sync_audit_write_failed");
  }
}
