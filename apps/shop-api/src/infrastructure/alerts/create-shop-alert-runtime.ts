import {
  AlertLinkCodec,
  type AlertLogger,
  type AlertProduct,
  type AlertTopic,
  ConfirmService,
  DigestRun,
  PreferencesService,
  RecordMatchService,
  type SendMode,
  StopService,
  SubscribeService,
  keyringFrom,
} from "@auction/alerts";
import type { Database } from "@auction/db";
import {
  laxAccountPageUrl,
  resolveLaxAccountOrigin,
} from "@auction/lax-ecosystem/lax-account-origin";
import {
  AlertMatchingService,
  type ArtworkMatchers,
} from "../../application/alerts/alert-matching.service.js";
import type {
  ReleaseAlertSummaryReader,
  ShopAlertAnnouncer,
} from "../../application/alerts/alert-ports.js";
import {
  FollowedArtistMatcher,
  ReleaseMatcher,
  followerResolver,
} from "../../application/alerts/artwork-matchers.js";
import {
  FOLLOW_ALERT_SOURCE,
  FollowAlertsService,
} from "../../application/alerts/follow-alerts.service.js";
import {
  type ShopAlertHandlers,
  createShopAlertHandlers,
} from "../../application/handlers/shop-alerts.handler.js";
import type { StorefrontOrigins } from "../../domain/storefront-origins.js";
import { hashLinkToken } from "../link-token.js";
import { resolveShopUserEmail } from "../resolve-shop-user-email.js";
import { ShopAlertCatalogue } from "./shop-alert-catalogue.js";
import {
  ShopAlertAnnouncementStore,
  ShopAlertDigestLedger,
  ShopAlertMatchLedger,
} from "./shop-alert-ledgers.js";
import { ShopAlertMailer } from "./shop-alert-mailer.js";
import {
  ArtistFollowerStore,
  ReleaseAlertSummaryStore,
  ShopAlertPublishRecorder,
} from "./shop-alert-publishing.js";
import { ShopAlertSubscriberStore } from "./shop-alert-subscriber.store.js";
import { ShopAlertTopicStore } from "./shop-alert-topic.store.js";
import { artAlertUrls, shopAlertUrls } from "./shop-alert-urls.js";

/** The topics a confirmation press switches on, per product. */
const CONFIRM_TOPICS: Readonly<Record<AlertProduct, readonly AlertTopic[]>> = {
  bid: [],
  shop: ["shop.releases"],
  art: ["art.followed_artists"],
};

export type ShopAlertRuntimeEnv = {
  ALERTS_SEND_MODE: SendMode;
  ALERT_LINK_SECRET: string;
  ALERT_LINK_KEY_ID: string;
  LAX_ACCOUNT_PUBLIC_ORIGIN?: string | undefined;
  NODE_ENV?: string | undefined;
  ALERT_LINK_PREVIOUS_SECRET?: string | undefined;
  ALERT_LINK_PREVIOUS_KEY_ID?: string | undefined;
};

type Logger = {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
};

export type ShopAlertRuntime = {
  mode: SendMode;
  /** Sign-up, confirm and stop, for the public routes. */
  handlers: ShopAlertHandlers;
  /** A signed-in person's own switches, for the Email alerts page in LAX Account. */
  preferences: Pick<PreferencesService, "view" | "setTopic">;
  /** Switches emails on when someone follows an artist on lax.art. */
  followAlerts: FollowAlertsService;
  /** Written inside the publish transaction. */
  announcer: ShopAlertAnnouncer;
  summary: ReleaseAlertSummaryReader;
  /** Turns announced works into matches. */
  matching: AlertMatchingService;
  /** One digest run per product: LAX Shop and lax.art. */
  digests: readonly DigestRun[];
};

/**
 * Wires the alert engine to shop-api's tables and email outbox. The API routes and the scheduler
 * each build their own runtime from it; nothing in it holds state between calls.
 */
export function createShopAlertRuntime(input: {
  db: Database;
  env: ShopAlertRuntimeEnv;
  origins: StorefrontOrigins;
  resolveMediaUrl: (value: string | null | undefined) => string | null;
  log: Logger;
}): ShopAlertRuntime {
  const { db, env, origins, log } = input;
  const clock = { now: () => new Date() };
  const subscribers = new ShopAlertSubscriberStore(db);
  const topics = new ShopAlertTopicStore(db);
  const matches = new ShopAlertMatchLedger(db);
  const digests = new ShopAlertDigestLedger(db);
  const announcements = new ShopAlertAnnouncementStore(db);
  const catalogue = new ShopAlertCatalogue(db, input.resolveMediaUrl);
  const mailer = new ShopAlertMailer(db);
  const engineLog: AlertLogger = {
    info: (fields, message) => log.info(fields, message),
    warn: (fields, message) => log.warn(fields, message),
  };
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
  const addresses = {
    // The Shop profile holds the account's verified address.
    async find(subjectId: string) {
      const email = await resolveShopUserEmail(db, subjectId);
      return email ? { email, verified: true } : null;
    },
  };
  const manageUrl = laxAccountPageUrl(
    resolveLaxAccountOrigin(env.LAX_ACCOUNT_PUBLIC_ORIGIN, env.NODE_ENV),
    "alerts",
  );
  const urls = {
    shop: shopAlertUrls(origins.shop, manageUrl),
    art: artAlertUrls(origins.art, manageUrl),
  } as const;
  const subscribe = new SubscribeService({
    subscribers,
    topics,
    mailer,
    codec,
    urls: urls.shop,
    addresses,
    clock,
  });
  const preferences = new PreferencesService({ subscribers, topics, subscribe, addresses, clock });
  const record = new RecordMatchService({ topics, ledger: matches, announcements, clock });
  const ensureFollower = followerResolver({
    subscribers,
    topics,
    enable: (subjectId) =>
      subscribe.enableForAccount({
        product: "art",
        subjectId,
        topic: "art.followed_artists",
        source: FOLLOW_ALERT_SOURCE,
      }),
  });
  const matchers: ArtworkMatchers = {
    shop_release: new ReleaseMatcher(record),
    art_original: new FollowedArtistMatcher({
      announcements,
      ledger: matches,
      followers: new ArtistFollowerStore(db),
      ensureFollower,
      clock,
    }),
  };
  const digestFor = (product: "shop" | "art") =>
    new DigestRun({
      product,
      subscribers,
      topics,
      matches,
      digests,
      validator: catalogue,
      mailer,
      codec,
      urls: urls[product],
      clock,
      log: engineLog,
    });

  return {
    mode: env.ALERTS_SEND_MODE,
    preferences,
    handlers: createShopAlertHandlers({
      subscribe,
      confirm: new ConfirmService({
        subscribers,
        topics,
        codec,
        clock,
        topicsToEnable: (product) => CONFIRM_TOPICS[product],
      }),
      stop: new StopService({ subscribers, topics, codec, clock }),
      preferences,
      codec,
      legacy: subscribers,
      hashLegacyToken: hashLinkToken,
      stopLegacy: async (id, now) => {
        await subscribers.stop(id, "link", now);
      },
    }),
    followAlerts: new FollowAlertsService({ subscribe, subscribers, log }),
    announcer: new ShopAlertPublishRecorder(),
    summary: new ReleaseAlertSummaryStore(db),
    matching: new AlertMatchingService({ queue: catalogue, artworks: catalogue, matchers, log }),
    digests: [digestFor("shop"), digestFor("art")],
  };
}
