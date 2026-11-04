import { createEngineHarness } from "@auction/alerts/testing";
import { describe, expect, it } from "vitest";
import { AlertMatchingService } from "./alert-matching.service.js";
import type { AlertArtwork } from "./alert-ports.js";
import { FollowedArtistMatcher, ReleaseMatcher, followerResolver } from "./artwork-matchers.js";

const artwork = (id: string, kind: AlertArtwork["kind"], title: string): AlertArtwork => ({
  id,
  slug: id,
  title,
  artistId: "artist-1",
  artistName: "Iris Calder",
  imageUrl: null,
  kind,
  published: true,
});

/** The engine as shop-api wires it, in memory: one person on both LAX Shop and lax.art. */
async function setup() {
  const h = createEngineHarness(new Date("2026-11-04T07:00:00Z"));
  h.accounts.set("sub-1", { email: "collector@example.com", verified: true });
  await h.subscribe.enableForAccount({
    product: "shop",
    subjectId: "sub-1",
    topic: "shop.releases",
    source: "test",
  });
  await h.subscribe.enableForAccount({
    product: "art",
    subjectId: "sub-1",
    topic: "art.followed_artists",
    source: "art_follow",
  });
  const works = new Map([
    ["e1", artwork("e1", "shop_release", "Harbour light, print")],
    ["o1", artwork("o1", "art_original", "Harbour light")],
  ]);
  const queue = [
    { itemKey: "artwork:e1", announce: true },
    { itemKey: "artwork:o1", announce: true },
  ];
  const matching = new AlertMatchingService({
    queue: { listUnexpanded: async () => queue },
    artworks: { find: async (id) => works.get(id) ?? null },
    matchers: {
      shop_release: new ReleaseMatcher(h.record),
      art_original: new FollowedArtistMatcher({
        announcements: h.stores,
        ledger: h.stores,
        followers: { listFollowerSubjects: async (_artist, after) => (after ? [] : ["sub-1"]) },
        ensureFollower: followerResolver({
          subscribers: h.stores,
          topics: h.stores,
          enable: async () => "enabled",
        }),
        clock: { now: () => h.now },
      }),
    },
    log: { warn: () => undefined },
  });
  await matching.run();
  return h;
}

describe("daily digests for LAX Shop and lax.art", () => {
  it("sends each product its own digest, one a day, and none before 08:00 London", async () => {
    const h = await setup();
    await h.digestRun("shop").run("on");
    expect(h.mailer.digests).toHaveLength(0);

    h.now = new Date("2026-11-04T08:05:00Z");
    await h.digestRun("shop").run("on");
    await h.digestRun("art").run("on");
    expect(h.mailer.digests.map((d) => d.product).sort()).toEqual(["art", "shop"]);
    const shop = h.mailer.digests.find((d) => d.product === "shop");
    const art = h.mailer.digests.find((d) => d.product === "art");
    expect(shop?.vm.subject).toBe("New edition: Harbour light, print");
    expect(art?.vm.subject).toBe("New work: Harbour light");
    expect(art?.activeTopics).toEqual(["art.followed_artists"]);
    expect(shop?.activeTopics).toEqual(["shop.releases"]);

    // Running again the same day sends nothing more.
    await h.digestRun("shop").run("on");
    await h.digestRun("art").run("on");
    expect(h.mailer.digests).toHaveLength(2);
  });

  it("holds a match that arrives after the day's digest until the next morning", async () => {
    const h = await setup();
    h.now = new Date("2026-11-04T08:05:00Z");
    await h.digestRun("art").run("on");
    const row = await h.stores.findBySubject("art", "sub-1");
    await h.stores.record([
      {
        subscriberId: row?.id ?? "",
        topic: "art.followed_artists",
        itemKey: "artwork:o2",
        groupKey: "artist-1",
        snapshot: { title: "Second work", path: "/artworks/o2" },
        matchedAt: h.now,
      },
    ]);
    await h.digestRun("art").run("on");
    expect(h.mailer.digests.filter((d) => d.product === "art")).toHaveLength(1);

    h.now = new Date("2026-11-05T08:05:00Z");
    await h.digestRun("art").run("on");
    const art = h.mailer.digests.filter((d) => d.product === "art");
    expect(art).toHaveLength(2);
    expect(art[1]?.vm.subject).toBe("New work: Second work");
  });

  it("drops a work that came off sale before the digest", async () => {
    const h = await setup();
    h.stale.set("artwork:o1", "withdrawn");
    h.now = new Date("2026-11-04T08:05:00Z");
    await h.digestRun("art").run("on");
    expect(h.mailer.digests.filter((d) => d.product === "art")).toHaveLength(0);
  });

  it("sends nothing in a dry run or when switched off", async () => {
    const h = await setup();
    h.now = new Date("2026-11-04T08:05:00Z");
    await h.digestRun("shop").run("dry_run");
    await h.digestRun("shop").run("off");
    expect(h.mailer.digests).toHaveLength(0);
  });
});
