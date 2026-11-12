import { ConfirmService } from "../application/confirm.service.js";
import { DigestRun } from "../application/digest-run.js";
import { PreferencesService } from "../application/preferences.service.js";
import { RecordMatchService } from "../application/record-match.service.js";
import { StopService } from "../application/stop.service.js";
import { SubscribeService } from "../application/subscribe.service.js";
import { AlertLinkCodec } from "../links/codec.js";
import type {
  AlertMailer,
  AlertUrls,
  ConfirmationMessage,
  DigestMessage,
  DigestNoticeInput,
  DigestNoticeWriter,
  MatchValidator,
  SubscriptionConfirmedHook,
  VerifiedAddressLookup,
} from "../ports.js";
import { MemoryAlertStores } from "./memory-stores.js";

const key = { id: "k1", secret: "harness-secret-0123456789abcdef" }; // gitleaks:allow

export class RecordingMailer implements AlertMailer {
  confirmations: ConfirmationMessage[] = [];
  digests: DigestMessage[] = [];
  failNextDigest = false;
  async sendConfirmation(message: ConfirmationMessage) {
    this.confirmations.push(message);
  }
  async sendDigest(message: DigestMessage) {
    if (this.failNextDigest) {
      this.failNextDigest = false;
      throw new Error("outbox down");
    }
    this.digests.push(message);
  }
}

/** Records the in-app notices a digest asks for; can be told to fail. */
export class RecordingNotices implements DigestNoticeWriter {
  written: DigestNoticeInput[] = [];
  failNext = false;
  async write(input: DigestNoticeInput) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("notice store down");
    }
    this.written.push(input);
  }
}

export const testUrls: AlertUrls = {
  confirm: (t) => `https://lax.bid/alerts/confirm?t=${t}`,
  stop: (t) => `https://lax.bid/alerts/unsubscribe?t=${t}`,
  oneClick: (t) => `https://lax.bid/alerts/unsubscribe?t=${t}`,
  manage: () => "https://lax.bid/settings#alerts",
  changeTimeZone: () => "https://account.lax.bid/account/profile#time-zone",
  site: (p) => `https://lax.bid${p}`,
};

/** The engine wired to in-memory stores and a recording mailer, with a clock the test moves. */
export function createEngineHarness(
  start = new Date("2026-11-03T09:00:00Z"),
  options: { afterConfirm?: SubscriptionConfirmedHook } = {},
) {
  let current = start;
  const clock = { now: () => current };
  const stores = new MemoryAlertStores();
  const mailer = new RecordingMailer();
  const accounts = new Map<string, { email: string; verified: boolean }>();
  const stale = new Map<string, string>();
  const addresses: VerifiedAddressLookup = { find: async (id) => accounts.get(id) ?? null };
  const validator: MatchValidator = {
    staleMatches: async (matches) =>
      new Map(
        matches.filter((m) => stale.has(m.itemKey)).map((m) => [m.id, stale.get(m.itemKey) ?? ""]),
      ),
  };
  const codec = new AlertLinkCodec({ signing: key, accepted: [key] });
  const log = { info: () => undefined, warn: () => undefined };
  const subscribe = new SubscribeService({
    subscribers: stores,
    topics: stores,
    mailer,
    codec,
    urls: testUrls,
    addresses,
    clock,
    ...(options.afterConfirm ? { afterConfirm: options.afterConfirm } : {}),
  });
  const common = { subscribers: stores, topics: stores, codec, clock };
  return {
    stores,
    mailer,
    codec,
    accounts,
    stale,
    subscribe,
    confirm: new ConfirmService({
      ...common,
      topicsToEnable: () => ["bid.new_sales"],
      ...(options.afterConfirm ? { afterConfirm: options.afterConfirm } : {}),
    }),
    stop: new StopService(common),
    preferences: new PreferencesService({
      subscribers: stores,
      topics: stores,
      subscribe,
      addresses,
      clock,
    }),
    record: new RecordMatchService({
      topics: stores,
      ledger: stores,
      announcements: stores,
      clock,
    }),
    digestRun: (product: "bid" | "shop" | "art" = "bid", notices?: DigestNoticeWriter) =>
      new DigestRun({
        product,
        subscribers: stores,
        topics: stores,
        matches: stores,
        digests: stores,
        validator,
        mailer,
        codec,
        urls: testUrls,
        clock,
        log,
        ...(notices ? { notices } : {}),
      }),
    set now(value: Date) {
      current = value;
    },
    get now() {
      return current;
    },
  };
}
