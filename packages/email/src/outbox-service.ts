import crypto from "node:crypto";
import type { Database } from "@auction/db";
import { emailOutbox, emailSuppression } from "@auction/db/schema";
import type { JobsOptions, Queue } from "bullmq";
import { eq } from "drizzle-orm";
import stringify from "safe-stable-stringify";
import type { TemplateName } from "./types.js";
import type { EmailEnqueueInput, IEmailService } from "./service.js";
import { RECIPIENT_RESOLUTION } from "./types.js";

export type EmailQueuePayload = {
  outboxId: string;
};

/** Minimal queue contract for outbox dispatch (decoupled from BullMQ generic variance). */
export interface EmailQueue {
  add(name: string, data: EmailQueuePayload, opts?: JobsOptions | undefined): Promise<unknown>;
}

/** Adapts a BullMQ queue instance for {@link PostmarkEmailService}. */
export function bindEmailQueue(queue: Queue): EmailQueue {
  return queue as EmailQueue;
}

export function emailHash(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function hashPayload(value: unknown): string {
  const canonical = stringify(value, undefined, 0) ?? "";
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function defaultIdempotencyKey(input: EmailEnqueueInput): string {
  return `${input.template}:${input.userId ?? emailHash(input.to)}:${hashPayload(input.vars)}`;
}

function snapshotPurgeDate(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + 30);
  return d;
}

export class PostmarkEmailService implements IEmailService {
  constructor(
    private readonly db: Database,
    private readonly emailQueue: EmailQueue,
  ) {}

  async enqueue<T extends EmailEnqueueInput["template"]>(
    input: EmailEnqueueInput<T>,
  ): Promise<{ outboxId: string }> {
    const idempotencyKey = input.idempotencyKey ?? defaultIdempotencyKey(input);
    const existing = await this.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      // A terminally-failed row (5 exhausted attempts) must not permanently block this
      // notification on every future trigger — e.g. a transient provider outage or a
      // since-fixed recipient issue should not mean the user never gets this email again.
      // Re-arm the same row and re-queue it under a fresh job id (BullMQ dedupes by jobId,
      // and the original job id is the outboxId, so a plain re-add would be swallowed).
      if (existing.status === "failed") {
        await this.db
          .update(emailOutbox)
          .set({ status: "pending", attempts: 0, lastError: null, messageId: null })
          .where(eq(emailOutbox.id, existing.id));
        await this.emailQueue.add(
          "send-email",
          { outboxId: existing.id },
          {
            jobId: `${existing.id}:retry:${Date.now()}`,
            attempts: 5,
            backoff: { type: "exponential", delay: 30_000 },
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        );
      }
      return { outboxId: existing.id };
    }

    const toEmailHash = emailHash(input.to);
    const [suppression] = await this.db
      .select({ emailHash: emailSuppression.emailHash })
      .from(emailSuppression)
      .where(eq(emailSuppression.emailHash, toEmailHash))
      .limit(1);

    const suppressed = Boolean(suppression);
    const status = suppressed && input.category === "transactional" ? "suppressed" : "pending";
    const flaggedAddress = suppressed && input.category === "auth";
    const resolution = input.recipientResolution ?? RECIPIENT_RESOLUTION[input.template];
    const shouldSnapshot = resolution === "snapshot";
    const now = new Date();

    const [inserted] = await this.db
      .insert(emailOutbox)
      .values({
        idempotencyKey,
        userId: input.userId ?? null,
        toEmailHash,
        toSnapshot: shouldSnapshot ? input.to : null,
        toSnapshotPurgeAt: shouldSnapshot ? snapshotPurgeDate(now) : null,
        template: input.template,
        vars: input.vars as Record<string, unknown>,
        status,
        stream: input.stream ?? "transactional",
        category: input.category,
        flaggedAddress,
        createdAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: emailOutbox.id, status: emailOutbox.status });

    const row = inserted ?? (await this.findByIdempotencyKey(idempotencyKey));
    if (!row) {
      throw new Error("Email outbox insert failed and no existing idempotency row was found");
    }

    if (row.status === "pending") {
      await this.emailQueue.add(
        "send-email",
        { outboxId: row.id },
        {
          jobId: row.id,
          attempts: 5,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      );
    }

    return { outboxId: row.id };
  }

  private async findByIdempotencyKey(idempotencyKey: string) {
    const [row] = await this.db
      .select({ id: emailOutbox.id, status: emailOutbox.status })
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, idempotencyKey))
      .limit(1);
    return row ?? null;
  }
}

export class ConsoleEmailService extends PostmarkEmailService {
  override async enqueue<T extends TemplateName>(
    input: EmailEnqueueInput<T>,
  ): Promise<{ outboxId: string }> {
    console.info(`[ConsoleEmailService] ${input.template} → ${input.to}`);
    return super.enqueue(input);
  }
}
