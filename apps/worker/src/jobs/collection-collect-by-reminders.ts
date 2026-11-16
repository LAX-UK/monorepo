import { collectionEligibility, londonDateKey, reminderWindow } from "@auction/domain";
import type { IEmailService } from "@auction/email";
import { Sentry } from "@auction/observability";
import type { ICollectionLotFactsReader } from "@auction/persistence/interfaces";
import type pino from "pino";
import type { ICollectByReader } from "../interfaces/collect-by.reader.js";
import type { ICollectionNoticeReader } from "../interfaces/collection-notice.reader.js";
import {
  collectByEmailsFor,
  collectByGroups,
  collectByKeyPrefix,
  collectByTemplateOf,
} from "../services/collect-by-notices.js";

/**
 * Emails buyers about storage on lots they have neither booked nor collected (ST15), from 09:00
 * London time: a week before the day they are asked to collect by and on it (with the rate),
 * "Storage charges have started" the day after, then a running total every 14 days. Each lot is
 * priced under the terms it was sold under, with its extensions, waiver and the days LAX held it,
 * through the rules the buyer's page reads. A waived lot gets nothing, and while its place raises no
 * storage invoices the day after keeps the approved "storage charges may apply" wording and no
 * running total goes.
 *
 * It can run as often as it likes: a person is sent a reminder only when it names a lot an earlier
 * one to them for the same reminder (kind, collect-by day and run of 14 days) did not, so a retry
 * sends nothing twice, booking one of three lots sends nothing more, and a lot that becomes eligible
 * later still gets its reminder. Earlier reminders are read from the outbox, failed ones included,
 * so a failed one is not re-armed every sweep. A lot with a check, a dispute or a refund open, or
 * one already booked or collected, is left out. Nothing is sold or disposed of (ST16).
 */
export async function runCollectByRemindersJob(options: {
  reader: Pick<ICollectByReader, "storedLotsWaiting" | "remindedLotIds">;
  notices: Pick<ICollectionNoticeReader, "accountRecipients">;
  facts: ICollectionLotFactsReader;
  emailService: IEmailService;
  webOrigin: string;
  log: pino.Logger;
  now?: () => Date;
}): Promise<{ groups: number; queued: number }> {
  const { reader, notices, facts, emailService, webOrigin, log, now = () => new Date() } = options;
  const at = now();
  if (!reminderWindow(at)) return { groups: 0, queued: 0 };

  const today = londonDateKey(at);
  const groups = collectByGroups(await reader.storedLotsWaiting({ today }), today, (lot, err) =>
    // One lot that cannot be priced keeps its buyer's page on today's notice; it must not stop the
    // others being reminded, and must not be silent either.
    log.warn(
      { err, lotId: lot.lotId, venueId: lot.venueId },
      "collection_collect_by_lot_not_priced",
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
      const winners = lots.flatMap((lot) => (lot.winnerId ? [lot.winnerId] : []));
      const people = await notices.accountRecipients(group.legalEntityId, winners);
      for (const email of collectByEmailsFor({ ...group, lots }, people, { webOrigin, now: at })) {
        const userId = email.userId as string;
        const reminded = await reader.remindedLotIds({
          keyPrefix: collectByKeyPrefix(group, userId),
          userId,
          today,
          template: collectByTemplateOf(group),
        });
        if (email.vars.lotIds.every((id) => reminded.has(id))) continue;
        await emailService.enqueue(email);
        queued += 1;
      }
    } catch (err) {
      // One account that cannot be read must not stop the rest being reminded, and must not be
      // silent either: a missing grant fails every group the same way.
      log.error({ err, legalEntityId: group.legalEntityId }, "collection_collect_by_failed");
      Sentry.captureException(err, {
        tags: { job: "collection_collect_by" },
        extra: { legalEntityId: group.legalEntityId, venueId: group.venueId },
      });
    }
  }
  log.info({ groups: groups.length, queued }, "collection collect-by reminders swept");
  return { groups: groups.length, queued };
}
