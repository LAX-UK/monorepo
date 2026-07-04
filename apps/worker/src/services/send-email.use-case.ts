import type { IEmailSender, TemplateName } from "@auction/email";
import type pino from "pino";
import type {
  EmailOutboxRow,
  IEmailOutboxRepository,
} from "../interfaces/email-outbox.repository.js";

export type SendEmailJobData = {
  outboxId: string;
};

type SendEmailUseCaseDeps = {
  outboxRepo: IEmailOutboxRepository;
  sender: IEmailSender;
  log: pino.Logger;
};

export async function sendEmailUseCase(
  { outboxRepo, sender, log }: SendEmailUseCaseDeps,
  data: SendEmailJobData,
): Promise<void> {
  const row = await outboxRepo.claimForSend(data.outboxId);

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

  const to = await resolveRecipient(outboxRepo, row);

  const suppressed = await outboxRepo.findSuppression(row.toEmailHash);
  if (suppressed && row.category !== "auth") {
    await outboxRepo.markSuppressed(row.id, "suppressed_after_enqueue");
    log.info({ outboxId: row.id }, "email send skipped: address suppressed after enqueue");
    return;
  }
  if (suppressed && row.category === "auth") {
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
    await outboxRepo.markSent(row.id, result.messageId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const terminal = row.attempts >= 5;
    await outboxRepo.markFailedOrPending(row.id, message, terminal);
    throw err;
  }
}

async function resolveRecipient(
  outboxRepo: IEmailOutboxRepository,
  row: EmailOutboxRow,
): Promise<string> {
  if (row.toSnapshot) return row.toSnapshot;
  if (!row.userId) {
    throw new Error(`email_outbox row ${row.id} has no recipient snapshot or user_id`);
  }
  const email = await outboxRepo.resolveUserEmail(row.userId);
  if (!email) {
    await outboxRepo.markSuppressed(row.id, "recipient user not found");
    await outboxRepo.insertSuppression(row.toEmailHash, "manual");
    throw new Error(`email_outbox row ${row.id} recipient user not found`);
  }
  return email;
}
