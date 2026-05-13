import type { Database } from "@auction/db";
import { emailOutbox, emailSuppression, user } from "@auction/db/schema";
import type { IEmailSender, TemplateName } from "@auction/email";
import type { Queue } from "bullmq";
import { and, eq, lt, sql } from "drizzle-orm";
import type pino from "pino";

export type SendEmailJobData = {
  outboxId: string;
};

type SendEmailJobDeps = {
  db: Database;
  sender: IEmailSender;
  log: pino.Logger;
};

export async function sendEmailJob({ db, sender, log }: SendEmailJobDeps, data: SendEmailJobData) {
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(emailOutbox)
      .set({
        status: "sending",
        attempts: sql`${emailOutbox.attempts} + 1`,
        lastError: null,
      })
      .where(and(eq(emailOutbox.id, data.outboxId), eq(emailOutbox.status, "pending")))
      .returning();
    if (updated) return updated;

    const [existing] = await tx
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.id, data.outboxId))
      .limit(1);
    return existing ?? null;
  });

  if (!row) {
    throw new Error(`email_outbox row not found: ${data.outboxId}`);
  }
  if (row.status === "sent" || row.status === "suppressed" || row.status === "failed") {
    log.info({ outboxId: data.outboxId, status: row.status }, "email job already terminal");
    return;
  }
  if (row.status !== "sending") {
    throw new Error(`email_outbox row ${data.outboxId} is not sendable (status=${row.status})`);
  }

  const to = await resolveRecipient(db, row);

  const [supNow] = await db
    .select({ emailHash: emailSuppression.emailHash })
    .from(emailSuppression)
    .where(eq(emailSuppression.emailHash, row.toEmailHash))
    .limit(1);
  if (supNow && row.category !== "auth") {
    await db
      .update(emailOutbox)
      .set({ status: "suppressed", lastError: "suppressed_after_enqueue" })
      .where(eq(emailOutbox.id, row.id));
    log.info({ outboxId: row.id }, "email send skipped: address suppressed after enqueue");
    return;
  }
  if (supNow && row.category === "auth") {
    log.warn({ outboxId: row.id }, "email send: auth mail to suppressed address (flagged)");
  }

  try {
    const result = await sender.send({
      outboxId: row.id,
      template: row.template as TemplateName,
      to,
      vars: row.vars as never,
      stream: row.stream,
      flaggedAddress: row.flaggedAddress,
      userId: row.userId,
    });
    await db
      .update(emailOutbox)
      .set({ status: "sent", messageId: result.messageId, sentAt: new Date(), lastError: null })
      .where(eq(emailOutbox.id, row.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const terminal = row.attempts >= 5;
    await db.transaction(async (tx) => {
      await tx
        .update(emailOutbox)
        .set({
          status: terminal ? "failed" : "pending",
          lastError: message,
        })
        .where(eq(emailOutbox.id, row.id));
    });
    throw err;
  }
}

export async function enqueueStaleEmailOutboxRows({
  db,
  queue,
}: {
  db: Database;
  queue: Queue<SendEmailJobData | Record<string, never>>;
}): Promise<number> {
  const stale = await db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(
      and(
        eq(emailOutbox.status, "pending"),
        lt(emailOutbox.createdAt, sql`now() - interval '5 minutes'`),
        lt(emailOutbox.attempts, 5),
      ),
    )
    .limit(100)
    .for("update", { skipLocked: true });

  for (const row of stale) {
    await queue.add(
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

  return stale.length;
}

async function resolveRecipient(
  db: Database,
  row: typeof emailOutbox.$inferSelect,
): Promise<string> {
  if (row.toSnapshot) return row.toSnapshot;
  if (!row.userId) {
    throw new Error(`email_outbox row ${row.id} has no recipient snapshot or user_id`);
  }
  const [recipient] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, row.userId))
    .limit(1);
  if (!recipient) {
    await db
      .update(emailOutbox)
      .set({ status: "suppressed", lastError: "recipient user not found" })
      .where(eq(emailOutbox.id, row.id));
    await db
      .insert(emailSuppression)
      .values({ emailHash: row.toEmailHash, reason: "manual" })
      .onConflictDoNothing();
    throw new Error(`email_outbox row ${row.id} recipient user not found`);
  }
  return recipient.email;
}
