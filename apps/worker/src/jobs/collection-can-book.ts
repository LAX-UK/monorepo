import {
  MAX_FREE_STORAGE_DAYS,
  collectionEligibility,
  londonDateKey,
  reminderWindow,
} from "@auction/domain";
import type { IEmailService } from "@auction/email";
import { Sentry } from "@auction/observability";
import type { ICollectionLotFactsReader } from "@auction/persistence/interfaces";
import type pino from "pino";
import type { ICollectByReader } from "../interfaces/collect-by.reader.js";
import type { ICollectionNoticeReader } from "../interfaces/collection-notice.reader.js";
import { canBookEmailsFor, canBookGroups, canBookKeyPrefix } from "../services/can-book-notices.js";

const DAY_MS = 24 * 60 * 60_000;

/**
 * Tells buyers, once per lot, that they can book a time to collect: the payment has cleared and
 * nothing is in the way (a check, a dispute or a refund), at a place that takes online bookings.
 * This keeps the purchase page's promise "We'll email you as soon as you can book": whichever
 * check was holding the lot, the next sweep after it closes finds the lot eligible. It runs from
 * 09:00 London time, as often as it likes; the outbox says which lots a person was already told
 * about, so booking, a retry or another sweep sends nothing twice. A lot already booked, handed
 * over or going by courier is left out.
 */
export async function runCanBookJob(options: {
  reader: Pick<ICollectByReader, "lotsClearedSince" | "remindedLotIds">;
  notices: Pick<ICollectionNoticeReader, "accountRecipients">;
  facts: Pick<ICollectionLotFactsReader, "read">;
  emailService: IEmailService;
  webOrigin: string;
  log: pino.Logger;
  now?: () => Date;
  /**
   * The earliest payment the email is for (COLLECTION_CAN_BOOK_EMAILS_FROM): purchases paid before
   * it are never sent the email, so the first sweep does not write to every buyer with a lot
   * already in storage. They are still offered booking on the purchases page, and still get their
   * storage reminders.
   */
  from: Date;
}): Promise<{ groups: number; queued: number }> {
  const {
    reader,
    notices,
    facts,
    emailService,
    webOrigin,
    log,
    from,
    now = () => new Date(),
  } = options;
  const at = now();
  if (!reminderWindow(at)) return { groups: 0, queued: 0 };

  const today = londonDateKey(at);
  const oldest = new Date(at.getTime() - MAX_FREE_STORAGE_DAYS * DAY_MS);
  const groups = canBookGroups(
    (await reader.lotsClearedSince(from.getTime() > oldest.getTime() ? from : oldest)).filter(
      (lot) => lot.clearedAt.getTime() >= from.getTime(),
    ),
  );
  let queued = 0;
  for (const group of groups) {
    try {
      const records = await facts.read(group.lots.map((lot) => lot.lotId));
      const lots = group.lots.filter((lot) => {
        const record = records.get(lot.lotId);
        return record !== undefined && collectionEligibility(record.facts).eligible;
      });
      if (lots.length === 0) continue;
      const bookable = { ...group, lots };
      const winners = lots.flatMap((lot) => (lot.winnerId ? [lot.winnerId] : []));
      const people = await notices.accountRecipients(group.legalEntityId, winners);
      const told = new Map<string, ReadonlySet<string>>();
      for (const person of people) {
        if (told.has(person.userId)) continue;
        told.set(
          person.userId,
          await reader.remindedLotIds({
            keyPrefix: canBookKeyPrefix(bookable, person.userId),
            userId: person.userId,
            today,
            template: "collection-can-book",
          }),
        );
      }
      const emails = canBookEmailsFor(bookable, people, (userId) => told.get(userId) ?? new Set(), {
        webOrigin,
      });
      for (const email of emails) {
        await emailService.enqueue(email);
        queued += 1;
      }
    } catch (err) {
      // One account that cannot be read must not stop the rest, and must not be silent either.
      log.error({ err, legalEntityId: group.legalEntityId }, "collection_can_book_failed");
      Sentry.captureException(err, {
        tags: { job: "collection_can_book" },
        extra: { legalEntityId: group.legalEntityId, venueId: group.venueId },
      });
    }
  }
  log.info({ groups: groups.length, queued }, "collection can-book emails swept");
  return { groups: groups.length, queued };
}
