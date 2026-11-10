import {
  DEFAULT_COLLECT_BY_POLICY,
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
import {
  collectByEmailsFor,
  collectByGroups,
  collectByKeyPrefix,
} from "../services/collect-by-notices.js";

/**
 * Emails buyers who have neither booked nor collected, from a week before the day they are asked
 * to collect by, and on it, from 09:00 London time. It can run as often as it likes: a person is
 * sent a reminder for a deadline only when it names a lot an earlier reminder to them for that
 * deadline did not, so booking one of three lots (what the email asks) sends nothing more, and a
 * lot that becomes eligible later still gets its reminder. Earlier reminders are read from the
 * outbox, failed ones included, so a failed one is not re-armed every sweep.
 * A lot with a check, a dispute or a refund open, or one already booked or collected, is left out.
 * Nothing is charged: "storage charges may apply" is wording, not logic.
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

  const today = londonDateKey(at);
  const groups = collectByGroups(
    await reader.storedLotsDue({
      today,
      defaultFreeStorageDays: DEFAULT_COLLECT_BY_POLICY.freeStorageDays,
      reminderLeadDays: DEFAULT_COLLECT_BY_POLICY.reminderLeadDays,
    }),
    today,
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
        const reminded = await reader.remindedLotIds(
          collectByKeyPrefix(group, email.userId as string),
        );
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
