import { reminderWindow } from "@auction/domain";
import type { IEmailService } from "@auction/email";
import type { INotificationWriteRepository } from "@auction/persistence/interfaces";
import type pino from "pino";
import type { ICollectionNoticeReader } from "../interfaces/collection-notice.reader.js";
import { collectionInAppNoticesFor } from "../services/collection-in-app-notices.js";
import {
  type CollectionNoticeConfig,
  collectionEmailsFor,
} from "../services/collection-notices.js";

/**
 * Emails the buyer the day before their collection, from 09:00 London time. It can run as often
 * as it likes: the window is the same all day and each reminder is keyed by the visit and its
 * time, so the outbox sends one once however many sweeps find it. A visit booked after that
 * morning's 09:00 is left alone (its confirmation has just gone), and one that was moved gets a
 * new reminder for its new time. The inbox reminder goes to the same people, and only with an
 * email this sweep queues for the first time, so it is written once too.
 */
export async function runCollectionRemindersJob(options: {
  reader: ICollectionNoticeReader;
  emailService: IEmailService;
  notifications: Pick<INotificationWriteRepository, "createMany">;
  config: Omit<CollectionNoticeConfig, "now">;
  log: pino.Logger;
  now?: () => Date;
}): Promise<{ visits: number; queued: number }> {
  const { reader, emailService, notifications, config, log, now = () => new Date() } = options;
  const at = now();
  const window = reminderWindow(at);
  if (!window) return { visits: 0, queued: 0 };

  const due = await reader.dueReminders(window);
  let queued = 0;
  for (const { bookingId } of due) {
    try {
      const visit = await reader.visit(bookingId);
      if (!visit) continue;
      const emails = collectionEmailsFor({ kind: "reminder" }, visit, { ...config, now: at });
      const alreadySent = await reader.existingOutboxKeys(
        emails.flatMap((email) => (email.idempotencyKey ? [email.idempotencyKey] : [])),
      );
      const remindedNow = new Set<string>();
      for (const email of emails) {
        const isNew = email.idempotencyKey !== undefined && !alreadySent.has(email.idempotencyKey);
        await emailService.enqueue(email);
        queued += 1;
        if (isNew && email.userId) remindedNow.add(email.userId);
      }
      const notices = collectionInAppNoticesFor({ kind: "reminder" }, visit, at).filter((n) =>
        remindedNow.has(n.userId),
      );
      if (notices.length > 0) await notifications.createMany(notices);
    } catch (err) {
      // One visit that cannot be read must not stop the rest being reminded.
      log.error({ err, bookingId }, "collection_reminder_failed");
    }
  }
  log.info({ visits: due.length, queued }, "collection reminders swept");
  return { visits: due.length, queued };
}
