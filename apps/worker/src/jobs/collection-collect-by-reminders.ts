import { collectionEligibility, londonDateKey, reminderWindow } from "@auction/domain";
import type { IEmailService } from "@auction/email";
import type { ICollectionLotFactsReader } from "@auction/persistence/interfaces";
import type pino from "pino";
import type { ICollectByReader } from "../interfaces/collect-by.reader.js";
import type { ICollectionNoticeReader } from "../interfaces/collection-notice.reader.js";
import { collectByEmailsFor, collectByGroups } from "../services/collect-by-notices.js";

/** The longest free period a place can set, plus a day: lots cleared earlier cannot be due. */
const LOOK_BACK_DAYS = 366;

/**
 * Emails buyers who have neither booked nor collected a week before, and on, the day they are
 * asked to collect by, from 09:00 London time. It can run as often as it likes: it only looks at
 * lots that cleared on the day today's reminder is for, and each email is keyed by the reminder,
 * the account, the deadline and the address, so the outbox sends one however many sweeps find it.
 * A lot with a check open, a dispute or a refund, or one already booked or collected, is left
 * alone. Nothing is charged: "storage charges may apply" is wording, not logic.
 */
export async function runCollectByRemindersJob(options: {
  reader: ICollectByReader;
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

  const since = new Date(at.getTime() - LOOK_BACK_DAYS * 24 * 60 * 60_000);
  const groups = collectByGroups(await reader.storedLotsClearedSince(since), londonDateKey(at));
  let queued = 0;
  for (const group of groups) {
    try {
      const records = await facts.read(group.lots.map((lot) => lot.lotId));
      const lots = group.lots.filter((lot) => {
        const record = records.get(lot.lotId);
        return record !== undefined && collectionEligibility(record.facts).eligible;
      });
      if (lots.length === 0) continue;
      const people = await notices.accountRecipients(group.legalEntityId);
      for (const email of collectByEmailsFor({ ...group, lots }, people, { webOrigin, now: at })) {
        await emailService.enqueue(email);
        queued += 1;
      }
    } catch (err) {
      // One account that cannot be read must not stop the rest being reminded.
      log.error({ err, legalEntityId: group.legalEntityId }, "collection_collect_by_failed");
    }
  }
  log.info({ groups: groups.length, queued }, "collection collect-by reminders swept");
  return { groups: groups.length, queued };
}
