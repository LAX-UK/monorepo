import { digestDateFor, isDigestDue } from "../domain/digest-day.js";
import { assembleDigest } from "../domain/digest.js";
import type { PendingMatch } from "../domain/match.js";
import type { AlertProduct, AlertTopic } from "../domain/products.js";
import type { SubscriberRecord } from "../domain/subscriber.js";
import type { AlertLinkCodec } from "../links/codec.js";
import type {
  AlertLogger,
  AlertMailer,
  AlertUrls,
  Clock,
  DigestLedger,
  DigestNoticeWriter,
  InAppTopicLookup,
  MatchLedger,
  MatchValidator,
  SubscriberStore,
  SubscriberZoneLookup,
  TopicStore,
} from "../ports.js";
import { stopLinks } from "./confirmation-links.js";

/** `off` does nothing, `dry_run` assembles and logs digests without sending, `on` sends. */
export type SendMode = "off" | "dry_run" | "on";

export type DigestRunStats = {
  mode: SendMode;
  localDate: string;
  considered: number;
  sent: number;
  /** Digests assembled and logged but not sent (dry run). */
  previewed: number;
  /** People with nothing left to say once stale or switched-off matches were removed. */
  empty: number;
  /** People who already had their one digest today; their matches wait for tomorrow. */
  capped: number;
  /** Digests claimed earlier whose email was sent again after an interruption. */
  resumed: number;
  /** Digests that held only in-app notices: every email topic of the person was off. */
  noticeOnly: number;
  failed: number;
};

export type DigestRunDeps = {
  product: AlertProduct;
  subscribers: SubscriberStore;
  topics: TopicStore;
  matches: MatchLedger;
  digests: DigestLedger;
  validator: MatchValidator;
  mailer: AlertMailer;
  codec: AlertLinkCodec;
  urls: AlertUrls;
  clock: Clock;
  log: AlertLogger;
  /** In-app notices for signed-in people; omitted where a product has none. */
  notices?: DigestNoticeWriter;
  /**
   * Which topics each signed-in person wants in the app. Those matches are kept for the notice
   * even when the topic's email is off; the email then leaves them out. Omitted, the app tells
   * the topics the email tells.
   */
  inApp?: InAppTopicLookup;
  /** Account time zones, so an account holder's times show on their own clock too. */
  zones?: SubscriberZoneLookup;
  batchSize?: number;
};

/**
 * The daily digest: at most one email per person per product per London day, and none when
 * nothing matched. Safe to run again: the day's digest is unique per person, and an interrupted
 * one is sent again under the same key, which the outbox collapses.
 */
export class DigestRun {
  constructor(private readonly deps: DigestRunDeps) {}

  async run(mode: SendMode): Promise<DigestRunStats> {
    const now = this.deps.clock.now();
    const stats: DigestRunStats = {
      mode,
      localDate: digestDateFor(now),
      considered: 0,
      sent: 0,
      previewed: 0,
      empty: 0,
      capped: 0,
      resumed: 0,
      noticeOnly: 0,
      failed: 0,
    };
    if (mode === "off" || !isDigestDue(now)) return stats;

    if (mode === "on") await this.resumeInterrupted(stats);
    const size = this.deps.batchSize ?? 500;
    let after: string | null = null;
    for (;;) {
      const page: string[] = await this.deps.matches.pendingSubscribers(
        this.deps.product,
        after,
        size,
      );
      if (page.length === 0) break;
      for (const subscriberId of page) {
        stats.considered += 1;
        try {
          await this.digestFor(subscriberId, mode, stats);
        } catch (err) {
          stats.failed += 1;
          this.deps.log.warn({ err, subscriberId }, "alert digest failed for one subscriber");
        }
      }
      after = page[page.length - 1] ?? null;
      if (page.length < size) break;
    }
    this.deps.log.info({ ...stats, product: this.deps.product }, "alert digest run finished");
    return stats;
  }

  private async resumeInterrupted(stats: DigestRunStats): Promise<void> {
    const { digests, subscribers, clock } = this.deps;
    const localDate = digestDateFor(clock.now());
    const unsent = await digests.unsent(this.deps.product, localDate, 500);
    for (const digest of unsent) {
      try {
        const record = await subscribers.findById(digest.subscriberId);
        const matches = await digests.matchesOf(digest.digestId);
        if (record && matches.length > 0) {
          await this.deliver(record, digest.digestId, matches, localDate, digest.idempotencyKey);
          stats.resumed += 1;
        }
        await digests.markSent(digest.digestId, clock.now());
      } catch (err) {
        stats.failed += 1;
        this.deps.log.warn({ err, digestId: digest.digestId }, "alert digest resume failed");
      }
    }
  }

  private async digestFor(subscriberId: string, mode: SendMode, stats: DigestRunStats) {
    const { subscribers, matches, digests, clock } = this.deps;
    const now = clock.now();
    const record = await subscribers.findById(subscriberId);
    const pending = await matches.pendingFor(subscriberId);
    if (!record || record.status !== "confirmed") {
      await matches.drop(
        pending.map((m) => m.id),
        "not_subscribed",
        now,
      );
      stats.empty += 1;
      return;
    }
    const wanted = await this.wantedTopics(record);
    const live = await this.removeUnwanted(pending, wanted.all, now);
    const vm = assembleDigest(live);
    if (!vm) {
      stats.empty += 1;
      return;
    }
    if (mode === "dry_run") {
      this.deps.log.info(
        { subscriberId, subject: vm.subject, items: vm.totalItems, product: record.product },
        "alert digest dry run",
      );
      stats.previewed += 1;
      return;
    }
    const localDate = digestDateFor(now);
    const idempotencyKey = `alert-digest:${record.product}:${subscriberId}:${localDate}`;
    const claim = await digests.claim({
      subscriberId,
      product: record.product,
      localDate,
      matchIds: live.map((m) => m.id),
      idempotencyKey,
      now,
    });
    if (!claim) {
      stats.capped += 1;
      return;
    }
    const emailed = await this.deliver(record, claim.digestId, live, localDate, idempotencyKey);
    await digests.markSent(claim.digestId, clock.now());
    if (emailed) stats.sent += 1;
    else stats.noticeOnly += 1;
  }

  /**
   * Tells the person: the app notice for the topics they want in the app, and the email for the
   * topics whose email is on, each from its own matches. True when an email went out.
   */
  private async deliver(
    record: SubscriberRecord,
    digestId: string,
    matches: readonly PendingMatch[],
    localDate: string,
    idempotencyKey: string,
  ): Promise<boolean> {
    const wanted = await this.wantedTopics(record);
    const noticeVm = assembleDigest(matches.filter((m) => wanted.inApp.has(m.topic)));
    if (noticeVm) await this.notify(record, digestId, noticeVm, localDate);
    const emailVm = assembleDigest(matches.filter((m) => wanted.email.has(m.topic)));
    if (!emailVm) return false;
    await this.send(record, emailVm, [...wanted.email], localDate, idempotencyKey);
    return true;
  }

  /** The topics told by email, the topics told in the app, and both together. */
  private async wantedTopics(record: SubscriberRecord) {
    const email = new Set(await this.activeTopics(record.id));
    // Without a lookup the app tells what the email tells, as it did before the app had its own switch.
    const inApp = new Set<AlertTopic>(
      !this.deps.inApp
        ? email
        : record.subjectId
          ? await this.deps.inApp.topicsOn(record.subjectId)
          : [],
    );
    return { email, inApp, all: new Set<AlertTopic>([...email, ...inApp]) };
  }

  /**
   * The same digest, told in the app. A failure here is logged and never holds back the email;
   * the writer is idempotent per digest, so an interrupted digest that is resumed fills it in.
   */
  private async notify(
    record: SubscriberRecord,
    digestId: string,
    vm: NonNullable<ReturnType<typeof assembleDigest>>,
    localDate: string,
  ) {
    const { notices, log } = this.deps;
    if (!notices || !record.subjectId) return;
    try {
      await notices.write({ digestId, subjectId: record.subjectId, localDate, vm });
    } catch (err) {
      log.warn({ err, digestId }, "alert digest in-app notice failed");
    }
  }

  private async send(
    record: SubscriberRecord,
    vm: NonNullable<ReturnType<typeof assembleDigest>>,
    activeTopics: readonly AlertTopic[],
    localDate: string,
    idempotencyKey: string,
  ) {
    const { mailer, codec, urls, zones } = this.deps;
    const viewerZone = record.subjectId && zones ? await zones.zoneOf(record.subjectId) : null;
    await mailer.sendDigest({
      product: record.product,
      to: record.email,
      subscriberId: record.id,
      localDate,
      idempotencyKey,
      vm,
      activeTopics,
      siteUrl: (path) => urls.site(path),
      ...stopLinks(record, codec, urls),
      manageUrl: record.subjectId ? urls.manage() : null,
      audience: record.subjectId ? "account" : "visitor",
      viewerZone,
      changeZoneUrl: urls.changeTimeZone(),
    });
  }

  private async activeTopics(subscriberId: string): Promise<AlertTopic[]> {
    return (await this.deps.topics.list(subscriberId)).filter((s) => s.emailOn).map((s) => s.topic);
  }

  /** Drops matches whose topic the person switched off, and those whose item went stale. */
  private async removeUnwanted(pending: PendingMatch[], on: ReadonlySet<AlertTopic>, now: Date) {
    const off = pending.filter((m) => !on.has(m.topic));
    if (off.length > 0) {
      await this.deps.matches.drop(
        off.map((m) => m.id),
        "topic_off",
        now,
      );
    }
    const kept = pending.filter((m) => on.has(m.topic));
    const stale = await this.deps.validator.staleMatches(kept);
    const byReason = new Map<string, string[]>();
    for (const [id, reason] of stale) byReason.set(reason, [...(byReason.get(reason) ?? []), id]);
    for (const [reason, ids] of byReason) await this.deps.matches.drop(ids, reason, now);
    return kept.filter((m) => !stale.has(m.id));
  }
}
