import { COLLECTOR_EMAILS_PER_ADDRESS_PER_DAY } from "@auction/domain";
import { type EmailEnqueueInput, type IEmailService, emailHash } from "@auction/email";
import type pino from "pino";
import type { ICollectionNoticeReader } from "../interfaces/collection-notice.reader.js";
import { isCollectorEmail } from "./collection-notices.js";

const DAY_MS = 24 * 60 * 60_000;

/**
 * Queues the emails a booking event made, keeping what goes to a named collector under a cap per
 * address. The buyer types that address, so repeated bookings and changes must not turn it into a
 * way to send an arbitrary address mail. Over the cap the email is skipped and logged (by the
 * address's hash, not the address). The buyer's own emails are never counted or held back.
 * The cap holds even while the booking rate limit fails open, because it counts the outbox.
 */
export async function enqueueCollectionEmails(options: {
  emails: readonly EmailEnqueueInput[];
  reader: Pick<ICollectionNoticeReader, "collectorEmailsSince">;
  emailService: Pick<IEmailService, "enqueue">;
  log: pino.Logger;
  now: Date;
  /** Emails to one address in 24 hours; the rule's own number unless a test sets another. */
  cap?: number;
}): Promise<{ queued: number; skipped: number }> {
  const {
    emails,
    reader,
    emailService,
    log,
    now,
    cap = COLLECTOR_EMAILS_PER_ADDRESS_PER_DAY,
  } = options;
  const since = new Date(now.getTime() - DAY_MS);
  const counted = new Map<string, number>();
  let queued = 0;
  let skipped = 0;
  for (const email of emails) {
    if (isCollectorEmail(email)) {
      const hash = emailHash(email.to);
      const already = counted.get(hash) ?? (await reader.collectorEmailsSince(hash, since));
      if (already >= cap) {
        skipped += 1;
        log.warn({ addressHash: hash, cap }, "collection_collector_email_capped");
        continue;
      }
      counted.set(hash, already + 1);
    }
    await emailService.enqueue(email);
    queued += 1;
  }
  return { queued, skipped };
}
