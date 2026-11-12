import {
  AlertLinkCodec,
  DigestRun,
  RecordMatchService,
  type SendMode,
  keyringFrom,
  webAlertUrls,
} from "@auction/alerts";
import type { Database } from "@auction/db";
import { OutboxAlertMailer } from "@auction/email";
import type { IEmailService } from "@auction/email";
import {
  laxAccountPageUrl,
  resolveLaxAccountOrigin,
} from "@auction/lax-ecosystem/lax-account-origin";
import {
  BidAlertAnnouncementStore,
  BidAlertDigestLedger,
  BidAlertFollowerProvisioner,
  BidAlertLotNoticeWriter,
  BidAlertLotReader,
  BidAlertLotStart,
  BidAlertMatchLedger,
  BidAlertMatchValidator,
  BidAlertSaleNoticeWriter,
  BidAlertSaleReader,
  BidAlertSeed,
  BidAlertSubscriberStore,
  BidAlertTopicStore,
  BidAlertWatcherReader,
  DrizzleRecipientZoneReader,
} from "@auction/persistence/repositories";
import type pino from "pino";
import { AccountZoneLookup } from "../alerts/account-zone-lookup.js";
import { BidDigestNotices } from "../alerts/bid-digest-notices.js";
import { BidLotMatcher } from "../alerts/bid-lot-matcher.js";
import { BidSaleAnnouncer } from "../alerts/bid-sale-announcer.js";
import type { WorkerEnv } from "../env.js";
import { BID_ALERT_MATCHING_PROJECTOR } from "../projectors/bid-alert-matching.js";
import type { BidAlertMatching } from "../projectors/lib/bid-alert-matching.types.js";

export type BidAlertRuntime = {
  mode: SendMode;
  matching: BidAlertMatching;
  digest: DigestRun;
  seed: BidAlertSeed;
};

/** Wires the engine to Bid's tables and the email outbox for the worker. */
export function createBidAlertRuntime(input: {
  env: Pick<
    WorkerEnv,
    | "ALERTS_SEND_MODE"
    | "ALERT_LINK_SECRET"
    | "ALERT_LINK_KEY_ID"
    | "ALERT_LINK_PREVIOUS_SECRET"
    | "ALERT_LINK_PREVIOUS_KEY_ID"
    | "WEB_ORIGIN"
    | "LAX_ACCOUNT_PUBLIC_ORIGIN"
    | "NODE_ENV"
  >;
  db: Database;
  email: IEmailService;
  log: pino.Logger;
}): BidAlertRuntime {
  const { env, db, email, log } = input;
  const mode = env.ALERTS_SEND_MODE;
  const subscribers = new BidAlertSubscriberStore(db);
  const topics = new BidAlertTopicStore(db);
  const matches = new BidAlertMatchLedger(db);
  const digests = new BidAlertDigestLedger(db);
  const clock = { now: () => new Date() };
  const accountOrigin = resolveLaxAccountOrigin(env.LAX_ACCOUNT_PUBLIC_ORIGIN, env.NODE_ENV);
  const seed = new BidAlertSeed(db);
  const record = new RecordMatchService({
    topics,
    ledger: matches,
    announcements: new BidAlertAnnouncementStore(db),
    clock,
  });
  const announcer = new BidSaleAnnouncer({
    sales: new BidAlertSaleReader(db),
    matches: record,
    notices: new BidAlertSaleNoticeWriter(db),
    sendNotices: mode === "on",
  });
  const lotStart = new BidAlertLotStart(db);
  const lotMatcher = new BidLotMatcher({
    lots: new BidAlertLotReader(db),
    watchers: new BidAlertWatcherReader(db),
    provisioner: new BidAlertFollowerProvisioner(db),
    matches,
    clock,
  });
  const codec = new AlertLinkCodec(
    keyringFrom({
      keyId: env.ALERT_LINK_KEY_ID,
      secret: env.ALERT_LINK_SECRET,
      previous:
        env.ALERT_LINK_PREVIOUS_SECRET && env.ALERT_LINK_PREVIOUS_KEY_ID
          ? { keyId: env.ALERT_LINK_PREVIOUS_KEY_ID, secret: env.ALERT_LINK_PREVIOUS_SECRET }
          : undefined,
    }),
  );
  return {
    mode,
    matching: {
      isSeeded: () => seed.isSeeded(),
      handle: (event) => announcer.handle(event),
      lotStart: () => lotStart.position(),
      handleLots: (events) => lotMatcher.handle(events),
    },
    digest: new DigestRun({
      product: "bid",
      subscribers,
      topics,
      matches,
      digests,
      validator: new BidAlertMatchValidator(db),
      mailer: new OutboxAlertMailer({ email }),
      notices: new BidDigestNotices({ notices: new BidAlertLotNoticeWriter(db) }),
      codec,
      zones: new AccountZoneLookup(new DrizzleRecipientZoneReader(db)),
      urls: webAlertUrls(
        env.WEB_ORIGIN,
        laxAccountPageUrl(accountOrigin, "alerts"),
        laxAccountPageUrl(accountOrigin, "timeZone"),
      ),
      clock,
      log: { info: (f, m) => log.info(f, m), warn: (f, m) => log.warn(f, m) },
    }),
    seed,
  };
}

export { BID_ALERT_MATCHING_PROJECTOR };
