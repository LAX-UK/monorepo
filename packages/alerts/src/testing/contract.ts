import { describe, expect, it } from "vitest";
import type { MatchSnapshot } from "../domain/match.js";
import type { AlertProduct } from "../domain/products.js";
import type {
  AnnouncementStore,
  DigestLedger,
  MatchLedger,
  SubscriberStore,
  TopicStore,
} from "../ports.js";

export type AlertStoreBundle = {
  subscribers: SubscriberStore;
  topics: TopicStore;
  matches: MatchLedger;
  digests: DigestLedger;
  announcements: AnnouncementStore;
  /** Gives the contract a place to start from; each test gets a fresh, empty store. */
  teardown?: () => Promise<void>;
  /** A subject id the store accepts (a real user where the table has a foreign key). */
  newSubjectId?: () => Promise<string>;
};

const NOW = new Date("2026-11-03T09:00:00.000Z");
const snapshot: MatchSnapshot = { title: "Modern British and Irish Art", path: "/sales/modern" };

/**
 * The behaviour every storage adapter of the engine must show. The package runs it against the
 * in-memory reference; each product runs it against its own database tables.
 */
export function describeAlertStoreContract(
  name: string,
  product: AlertProduct,
  create: () => Promise<AlertStoreBundle>,
): void {
  describe(`alert stores: ${name}`, () => {
    const withStores = async (fn: (s: AlertStoreBundle) => Promise<void>) => {
      const stores = await create();
      try {
        await fn(stores);
      } finally {
        await stores.teardown?.();
      }
    };
    const consent = { consentText: "We'll email you.", consentSource: "web_home_alerts" };

    it("keeps one subscriber per address and restarts a stopped one as pending", () =>
      withStores(async ({ subscribers }) => {
        const first = await subscribers.savePending({
          product,
          email: "a@example.com",
          ...consent,
          now: NOW,
        });
        expect(first.status).toBe("pending");
        await subscribers.confirm(first.id, NOW);
        await subscribers.stop(first.id, "link", NOW);
        const later = new Date(NOW.getTime() + 60_000);
        const again = await subscribers.savePending({
          product,
          email: "a@example.com",
          ...consent,
          now: later,
        });
        expect(again.id).toBe(first.id);
        expect(again.status).toBe("pending");
        expect(again.requestedAt.getTime()).toBe(later.getTime());
      }));

    it("leaves a confirmed subscriber alone when someone asks again", () =>
      withStores(async ({ subscribers }) => {
        const row = await subscribers.savePending({
          product,
          email: "b@example.com",
          ...consent,
          now: NOW,
        });
        await subscribers.confirm(row.id, NOW);
        const again = await subscribers.savePending({
          product,
          email: "b@example.com",
          ...consent,
          now: new Date(NOW.getTime() + 1000),
        });
        expect(again.status).toBe("confirmed");
      }));

    it("confirms only a pending subscriber, and stops only once", () =>
      withStores(async ({ subscribers }) => {
        const row = await subscribers.savePending({
          product,
          email: "c@example.com",
          ...consent,
          now: NOW,
        });
        expect(await subscribers.confirm(row.id, NOW)).toBe(true);
        expect(await subscribers.confirm(row.id, NOW)).toBe(false);
        expect(await subscribers.stop(row.id, "one_click", NOW)).toBe(true);
        expect(await subscribers.stop(row.id, "one_click", NOW)).toBe(false);
        expect((await subscribers.findById(row.id))?.status).toBe("stopped");
      }));

    it("confirms an account at once and finds it by its subject", () =>
      withStores(async ({ subscribers, newSubjectId }) => {
        const subjectId = (await newSubjectId?.()) ?? "user-1";
        const row = await subscribers.saveConfirmedForAccount({
          product,
          email: "d@example.com",
          subjectId,
          ...consent,
          now: NOW,
        });
        expect(row.status).toBe("confirmed");
        expect((await subscribers.findBySubject(product, subjectId))?.id).toBe(row.id);
      }));

    it("keeps an address that complained stopped when its account switches alerts on", () =>
      withStores(async ({ subscribers, newSubjectId }) => {
        const subjectId = (await newSubjectId?.()) ?? "user-9";
        const row = await subscribers.saveConfirmedForAccount({
          product,
          email: "complaint@example.com",
          subjectId,
          ...consent,
          now: NOW,
        });
        await subscribers.stop(row.id, "complaint", NOW);
        const again = await subscribers.saveConfirmedForAccount({
          product,
          email: "complaint@example.com",
          subjectId,
          ...consent,
          now: NOW,
        });
        expect(again.status).toBe("stopped");
      }));

    it("lists only confirmed subscribers whose topic email is on, in id order, in pages", () =>
      withStores(async ({ subscribers, topics }) => {
        const ids: string[] = [];
        for (const email of ["e1@example.com", "e2@example.com", "e3@example.com"]) {
          const row = await subscribers.savePending({ product, email, ...consent, now: NOW });
          await subscribers.confirm(row.id, NOW);
          await topics.setEmail(row.id, "bid.new_sales", true, "person", NOW);
          ids.push(row.id);
        }
        const off = await subscribers.savePending({
          product,
          email: "off@example.com",
          ...consent,
          now: NOW,
        });
        await subscribers.confirm(off.id, NOW);
        await topics.setEmail(off.id, "bid.new_sales", false, "person", NOW);
        const pending = await subscribers.savePending({
          product,
          email: "pending@example.com",
          ...consent,
          now: NOW,
        });
        await topics.setEmail(pending.id, "bid.new_sales", true, "person", NOW);

        const sorted = [...ids].sort();
        const first = await topics.listEmailRecipients("bid.new_sales", null, 2);
        expect(first.map((r) => r.subscriberId)).toEqual(sorted.slice(0, 2));
        const rest = await topics.listEmailRecipients("bid.new_sales", sorted[1] ?? null, 2);
        expect(rest.map((r) => r.subscriberId)).toEqual(sorted.slice(2));
      }));

    it("records a match once per subscriber, topic and item", () =>
      withStores(async ({ subscribers, matches }) => {
        const row = await subscribers.savePending({
          product,
          email: "f@example.com",
          ...consent,
          now: NOW,
        });
        const match = {
          subscriberId: row.id,
          topic: "bid.new_sales" as const,
          itemKey: "sale:1",
          groupKey: null,
          snapshot,
          matchedAt: NOW,
        };
        expect(await matches.record([match])).toBe(1);
        expect(await matches.record([match])).toBe(0);
        expect(await matches.pendingFor(row.id)).toHaveLength(1);
        expect(await matches.pendingSubscribers(product, null, 10)).toEqual([row.id]);
      }));

    it("takes one digest per person per day and attaches the matches to it", () =>
      withStores(async ({ subscribers, matches, digests }) => {
        const row = await subscribers.savePending({
          product,
          email: "g@example.com",
          ...consent,
          now: NOW,
        });
        await matches.record([
          {
            subscriberId: row.id,
            topic: "bid.new_sales",
            itemKey: "sale:1",
            groupKey: null,
            snapshot,
            matchedAt: NOW,
          },
          {
            subscriberId: row.id,
            topic: "bid.new_sales",
            itemKey: "sale:2",
            groupKey: null,
            snapshot,
            matchedAt: NOW,
          },
        ]);
        const pending = await matches.pendingFor(row.id);
        const claim = {
          subscriberId: row.id,
          product,
          localDate: "2026-11-03",
          matchIds: pending.map((m) => m.id),
          idempotencyKey: "k1",
          now: NOW,
        };
        const first = await digests.claim(claim);
        expect(first).not.toBeNull();
        expect(await digests.claim({ ...claim, idempotencyKey: "k2" })).toBeNull();
        expect(await matches.pendingFor(row.id)).toHaveLength(0);
        expect(await matches.pendingSubscribers(product, null, 10)).toEqual([]);
        expect(await digests.matchesOf(first?.digestId ?? "")).toHaveLength(2);

        expect(await digests.unsent(product, "2026-11-03", 10)).toEqual([
          { digestId: first?.digestId, subscriberId: row.id, idempotencyKey: "k1" },
        ]);
        await digests.markSent(first?.digestId ?? "", NOW);
        expect(await digests.unsent(product, "2026-11-03", 10)).toEqual([]);
        // The next London day is a new digest.
        const next = await digests.claim({ ...claim, localDate: "2026-11-04", matchIds: [] });
        expect(next).not.toBeNull();
      }));

    it("does not offer dropped matches again", () =>
      withStores(async ({ subscribers, matches }) => {
        const row = await subscribers.savePending({
          product,
          email: "h@example.com",
          ...consent,
          now: NOW,
        });
        await matches.record([
          {
            subscriberId: row.id,
            topic: "bid.new_sales",
            itemKey: "sale:9",
            groupKey: null,
            snapshot,
            matchedAt: NOW,
          },
        ]);
        const [pending] = await matches.pendingFor(row.id);
        await matches.drop([pending?.id ?? ""], "withdrawn", NOW);
        expect(await matches.pendingFor(row.id)).toEqual([]);
      }));

    it("announces an item once, whatever happens later", () =>
      withStores(async ({ announcements }) => {
        expect(await announcements.claimItem("sale:1", true, NOW)).toEqual({
          first: true,
          announce: true,
          expanded: false,
        });
        expect(await announcements.claimItem("sale:1", false, NOW)).toEqual({
          first: false,
          announce: true,
          expanded: false,
        });
        await announcements.markExpanded("sale:1", NOW);
        expect(await announcements.claimItem("sale:1", true, NOW)).toEqual({
          first: false,
          announce: true,
          expanded: true,
        });
      }));
  });
}
