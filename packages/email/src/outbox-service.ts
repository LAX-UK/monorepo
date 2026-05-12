import crypto from "node:crypto";
import type { Database } from "@auction/db";
import { emailOutbox, emailSuppression } from "@auction/db/schema";
import type { Queue } from "bullmq";
import { eq } from "drizzle-orm";
import stringify from "safe-stable-stringify";
import type { EmailEnqueueInput, IEmailService } from "./service.js";
import { RECIPIENT_RESOLUTION } from "./types.js";

type EmailQueuePayload = {
  outboxId: string;
};

type EmailQueue = Queue<EmailQueuePayload>;

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
    if (existing) return { outboxId: existing.id };

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

export class ConsoleEmailService extends PostmarkEmailService {}
