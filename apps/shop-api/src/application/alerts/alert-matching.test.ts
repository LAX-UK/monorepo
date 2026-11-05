import { createEngineHarness } from "@auction/alerts/testing";
import { describe, expect, it } from "vitest";
import { AlertMatchingService } from "./alert-matching.service.js";
import type { AlertArtwork, ArtistFollowerReader, QueuedAnnouncement } from "./alert-ports.js";
import { FollowedArtistMatcher, ReleaseMatcher, followerResolver } from "./artwork-matchers.js";

const edition: AlertArtwork = {
  id: "e1",
  slug: "harbour-light-print",
  title: "Harbour light, print",
  artistId: "artist-1",
  artistName: "Iris Calder",
  imageUrl: "https://media.example/harbour.jpg",
  kind: "shop_release",
  published: true,
};
const original: AlertArtwork = {
  ...edition,
  id: "o1",
  slug: "harbour-light",
  title: "Harbour light",
  kind: "art_original",
};

function setup() {
  const h = createEngineHarness();
  const followers = new Map<string, string[]>();
  const readers: ArtistFollowerReader = {
    listFollowerSubjects: async (artistId, after, limit) =>
      (followers.get(artistId) ?? [])
        .filter((s) => (after ? s > after : true))
        .sort()
        .slice(0, limit),
  };
  const ensureFollower = followerResolver({
    subscribers: h.stores,
    topics: h.stores,
    enable: (subjectId) =>
      h.subscribe.enableForAccount({
        product: "art",
        subjectId,
        topic: "art.followed_artists",
        source: "art_follow",
      }),
  });
  const release = new ReleaseMatcher(h.record);
  const followed = new FollowedArtistMatcher({
    announcements: h.stores,
    ledger: h.stores,
    followers: readers,
    ensureFollower,
    clock: { now: () => h.now },
  });
  const catalogue = new Map<string, AlertArtwork>([
    [edition.id, edition],
    [original.id, original],
  ]);
  const queue: QueuedAnnouncement[] = [];
  const matching = new AlertMatchingService({
    queue: { listUnexpanded: async () => queue },
    artworks: { find: async (id) => catalogue.get(id) ?? null },
    matchers: { shop_release: release, art_original: followed },
    log: { warn: () => undefined },
  });
  async function subscriber(
    product: "shop" | "art",
    subject: string,
    topic: "shop.releases" | "art.followed_artists",
    on = true,
  ) {
    h.accounts.set(subject, { email: `${subject}@example.com`, verified: true });
    await h.subscribe.enableForAccount({
      product,
      subjectId: subject,
      topic,
      source: "test",
      emailOn: on,
    });
    return (await h.stores.findBySubject(product, subject))?.id ?? "";
  }
  const pendingFor = async (id: string) => (await h.stores.pendingFor(id)).map((m) => m.itemKey);
  return { h, followers, catalogue, queue, matching, subscriber, pendingFor };
}

describe("release matching", () => {
  it("matches every subscriber with release emails on, and no one else", async () => {
    const { h, queue, matching, subscriber, pendingFor } = setup();
    const on = await subscriber("shop", "s1", "shop.releases");
    const off = await subscriber("shop", "s2", "shop.releases", false);
    const follower = await subscriber("art", "s3", "art.followed_artists");
    queue.push({ itemKey: "artwork:e1", announce: true });
    const stats = await matching.run();
    expect(stats).toEqual({ handled: 1, skipped: 0, failed: 0 });
    expect(await pendingFor(on)).toEqual(["artwork:e1"]);
    expect(await pendingFor(off)).toEqual([]);
    expect(await pendingFor(follower)).toEqual([]);
    const [match] = await h.stores.pendingFor(on);
    expect(match?.snapshot).toMatchObject({
      title: "Harbour light, print",
      subtitle: "Iris Calder",
      path: "/artworks/harbour-light-print",
      imageUrl: "https://media.example/harbour.jpg",
    });
  });

  it("tells no one about an edition staff left unannounced, and still counts it as announced", async () => {
    const { queue, matching, subscriber, pendingFor, h } = setup();
    const on = await subscriber("shop", "s1", "shop.releases");
    queue.push({ itemKey: "artwork:e1", announce: false });
    await matching.run();
    expect(await pendingFor(on)).toEqual([]);
    expect((await h.stores.claimItem("artwork:e1", true, h.now)).expanded).toBe(true);
  });

  it("reaches a person once for an edition, however often it is matched again", async () => {
    const { queue, matching, subscriber, pendingFor } = setup();
    const on = await subscriber("shop", "s1", "shop.releases");
    queue.push({ itemKey: "artwork:e1", announce: true });
    await matching.run();
    await matching.run();
    expect(await pendingFor(on)).toEqual(["artwork:e1"]);
  });

  it("skips a work that is off sale or no longer something alerts are sent for", async () => {
    const { queue, matching, catalogue } = setup();
    catalogue.set("e1", { ...edition, published: false });
    queue.push({ itemKey: "artwork:e1", announce: true });
    queue.push({ itemKey: "artwork:gone", announce: true });
    queue.push({ itemKey: "sale:12", announce: true });
    expect(await matching.run()).toEqual({ handled: 0, skipped: 3, failed: 0 });
  });
});

describe("followed artist matching", () => {
  it("matches the artist's followers whose emails are on, grouped under the artist", async () => {
    const { h, followers, queue, matching, subscriber, pendingFor } = setup();
    const a = await subscriber("art", "f1", "art.followed_artists");
    const b = await subscriber("art", "f2", "art.followed_artists");
    await subscriber("art", "other", "art.followed_artists");
    followers.set("artist-1", ["f1", "f2"]);
    followers.set("artist-2", ["other"]);
    queue.push({ itemKey: "artwork:o1", announce: true });
    await matching.run();
    expect(await pendingFor(a)).toEqual(["artwork:o1"]);
    expect(await pendingFor(b)).toEqual(["artwork:o1"]);
    expect(await pendingFor(await subscriberIdOf(h, "other"))).toEqual([]);
    const [match] = await h.stores.pendingFor(a);
    expect(match).toMatchObject({
      topic: "art.followed_artists",
      groupKey: "artist-1",
      snapshot: { groupLabel: "Iris Calder", path: "/artworks/harbour-light" },
    });
  });

  it("skips a follower who switched the emails off or stopped them", async () => {
    const { h, followers, queue, matching, subscriber, pendingFor } = setup();
    const off = await subscriber("art", "f1", "art.followed_artists", false);
    const stopped = await subscriber("art", "f2", "art.followed_artists");
    await h.stores.stop(stopped, "link", h.now);
    followers.set("artist-1", ["f1", "f2"]);
    queue.push({ itemKey: "artwork:o1", announce: true });
    await matching.run();
    expect(await pendingFor(off)).toEqual([]);
    expect(await pendingFor(stopped)).toEqual([]);
  });

  it("switches emails on for a follower who has never had a row, using the verified address", async () => {
    const { h, followers, queue, matching, pendingFor } = setup();
    h.accounts.set("old-follower", { email: "old@example.com", verified: true });
    h.accounts.set("unverified", { email: "u@example.com", verified: false });
    followers.set("artist-1", ["old-follower", "unverified", "no-account"]);
    queue.push({ itemKey: "artwork:o1", announce: true });
    await matching.run();
    const row = await h.stores.findBySubject("art", "old-follower");
    expect(row).toMatchObject({ status: "confirmed", email: "old@example.com" });
    expect(await pendingFor(row?.id ?? "")).toEqual(["artwork:o1"]);
    expect(await h.stores.findBySubject("art", "unverified")).toBeNull();
    expect(await h.stores.findBySubject("art", "no-account")).toBeNull();
  });

  it("does not replay an original already announced, and sends nothing when staff left it quiet", async () => {
    const { h, followers, queue, matching, subscriber, pendingFor } = setup();
    const a = await subscriber("art", "f1", "art.followed_artists");
    followers.set("artist-1", ["f1"]);
    await h.stores.claimItem("artwork:o1", false, h.now);
    await h.stores.markExpanded("artwork:o1", h.now);
    queue.push({ itemKey: "artwork:o1", announce: true });
    await matching.run();
    expect(await pendingFor(a)).toEqual([]);
  });

  it("pages through a large following without skipping or repeating anyone", async () => {
    const { h, followers, queue, matching, subscriber } = setup();
    const subjects = Array.from({ length: 1203 }, (_, i) => `f${String(i).padStart(5, "0")}`);
    for (const s of subjects) h.accounts.set(s, { email: `${s}@example.com`, verified: true });
    await subscriber("art", subjects[0] ?? "", "art.followed_artists");
    followers.set("artist-1", subjects);
    queue.push({ itemKey: "artwork:o1", announce: true });
    await matching.run();
    let matched = 0;
    for (const s of subjects) {
      const row = await h.stores.findBySubject("art", s);
      if (row && (await h.stores.pendingFor(row.id)).length === 1) matched += 1;
    }
    expect(matched).toBe(1203);
  });
});

async function subscriberIdOf(h: ReturnType<typeof createEngineHarness>, subject: string) {
  return (await h.stores.findBySubject("art", subject))?.id ?? "";
}
