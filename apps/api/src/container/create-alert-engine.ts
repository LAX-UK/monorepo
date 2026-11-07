import {
  AlertLinkCodec,
  ConfirmService,
  PreferencesService,
  StopService,
  SubscribeService,
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
import type { IUserRepository } from "@auction/persistence/interfaces";
import {
  BidAlertSaleReader,
  BidAlertSubscriberStore,
  BidAlertTopicStore,
  DrizzleEmailSuppressionRepository,
} from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import { liftOptOutOnConfirm } from "./lift-opt-out-on-confirm.js";

/** The Bid alert engine as the API uses it: sign-up, links, stopping and a client's own switches. */
export type BidAlertEngine = {
  subscribe: SubscribeService;
  confirm: ConfirmService;
  stop: StopService;
  preferences: PreferencesService;
  saleReader: BidAlertSaleReader;
  /** Until when the first list's routes and links still work. */
  legacyUntil: Date;
};

/** The topics a confirmation press switches on for Bid. */
const BID_CONFIRM_TOPICS = ["bid.new_sales"] as const;

export function createBidAlertEngine(input: {
  env: Env;
  db: Database;
  email: IEmailService;
  userRepo: Pick<IUserRepository, "findById" | "findVerifiedIdByEmail">;
}): BidAlertEngine {
  const { env, db, email, userRepo } = input;
  const subscribers = new BidAlertSubscriberStore(db);
  const suppressions = new DrizzleEmailSuppressionRepository(db);
  const topics = new BidAlertTopicStore(db);
  const clock = { now: () => new Date() };
  const codec = new AlertLinkCodec(
    keyringFrom({
      keyId: env.ALERT_LINK_KEY_ID,
      secret: env.ALERT_LINK_SECRET,
      previous:
        env.ALERT_LINK_PREVIOUS_SECRET && env.ALERT_LINK_PREVIOUS_KEY_ID
          ? { keyId: env.ALERT_LINK_PREVIOUS_KEY_ID, secret: env.ALERT_LINK_PREVIOUS_SECRET }
          : undefined,
    }),
    { secret: env.EMAIL_UNSUBSCRIBE_SECRET, acceptUntil: env.ALERT_LEGACY_LINKS_UNTIL },
  );
  const addresses = {
    async find(userId: string) {
      const profile = await userRepo.findById(userId);
      if (!profile) return null;
      return {
        email: profile.email,
        verified: (await userRepo.findVerifiedIdByEmail(profile.email)) === userId,
      };
    },
  };
  // One step for the confirm link and for an account turning alerts on.
  const liftOptOut = liftOptOutOnConfirm(suppressions);
  const subscribe = new SubscribeService({
    subscribers,
    topics,
    mailer: new OutboxAlertMailer({ email }),
    codec,
    urls: webAlertUrls(
      env.WEB_ORIGIN,
      laxAccountPageUrl(
        resolveLaxAccountOrigin(env.LAX_ACCOUNT_PUBLIC_ORIGIN, env.NODE_ENV),
        "alerts",
      ),
    ),
    addresses,
    clock,
    afterConfirm: liftOptOut,
  });
  return {
    subscribe,
    confirm: new ConfirmService({
      subscribers,
      topics,
      codec,
      clock,
      topicsToEnable: () => BID_CONFIRM_TOPICS,
      afterConfirm: liftOptOut,
    }),
    stop: new StopService({ subscribers, topics, codec, clock }),
    preferences: new PreferencesService({ subscribers, topics, subscribe, addresses, clock }),
    saleReader: new BidAlertSaleReader(db),
    legacyUntil: env.ALERT_LEGACY_LINKS_UNTIL,
  };
}
