import {
  ADMIN_HOME_FEATURE_SLOT_VALUES,
  AdminHomeFeatureIssueSchema,
} from "@auction/shop-contracts";
import {
  HOME_FEATURE_SLOTS,
  type HomeFeatureIssueReason,
  type HomeFeatureTargetFacts,
} from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";
import { HomeFeaturesRejectedError } from "../../errors/home-features-rejected-error.js";
import {
  EMPTY_HOME_FEATURES,
  createInMemoryHomeFeatures,
} from "../../test-support/in-memory-home-features.js";
import { createHomeFeaturesService } from "./home-features.service.js";

const NOW = new Date("2026-10-29T10:00:00.000Z");
const actor = { actorSubjectId: "staff-1", idempotencyKey: "key-1" };
const artist = (id: string): HomeFeatureTargetFacts => ({ kind: "artist", id });

describe("HomeFeaturesService.replace", () => {
  it("publishes the list in order and audits it before and after", async () => {
    const { service, add, audit, writes, locks } = createInMemoryHomeFeatures({
      saved: { featured_artists: ["a"] },
      now: NOW,
    });
    add(artist("a"), artist("b"));

    const result = await service.replace({ ...actor, slot: "featured_artists", ids: ["b", "a"] });

    expect(result).toEqual({ features: EMPTY_HOME_FEATURES, refreshesArt: true });
    expect(locks).toEqual(["featured_artists"]);
    expect(writes).toEqual([
      {
        slots: ["featured_artists"],
        placements: [
          { slot: "featured_artists", position: 0, target: { kind: "artist", id: "b" } },
          { slot: "featured_artists", position: 1, target: { kind: "artist", id: "a" } },
        ],
        publishedAt: NOW,
      },
    ]);
    expect(audit).toEqual([
      {
        actorSubjectId: "staff-1",
        capability: "editorial.publish",
        action: "home_features.replace",
        targetType: "shop_home_placement",
        targetId: "featured_artists",
        beforeJson: { ids: ["a"] },
        afterJson: { ids: ["b", "a"] },
      },
    ]);
  });

  it("asks lax.art to refresh only for the artists it shares", async () => {
    const { service, add } = createInMemoryHomeFeatures();
    add({ kind: "category", id: "c" });
    const result = await service.replace({ ...actor, slot: "featured_categories", ids: ["c"] });
    expect(result.refreshesArt).toBe(false);
  });

  it("clears a slot with an empty list", async () => {
    const { service, saved } = createInMemoryHomeFeatures({ saved: { featured_prints: ["p"] } });
    await service.replace({ ...actor, slot: "featured_prints", ids: [] });
    expect(saved.featured_prints).toEqual([]);
  });

  it("refuses a ninth artist and writes nothing", async () => {
    const { service, add, writes, audit } = createInMemoryHomeFeatures();
    const ids = Array.from({ length: 9 }, (_, index) => `artist-${index}`);
    add(...ids.map(artist));

    const attempt = service.replace({ ...actor, slot: "featured_artists", ids });

    await expect(attempt).rejects.toBeInstanceOf(HomeFeaturesRejectedError);
    await expect(attempt).rejects.toMatchObject({
      statusCode: 400,
      issues: [{ index: 8, targetId: "artist-8", reason: "over_limit" }],
    });
    expect(writes).toEqual([]);
    expect(audit).toEqual([]);
  });

  it("refuses the same artist twice", async () => {
    const { service, add } = createInMemoryHomeFeatures();
    add(artist("a"));
    await expect(
      service.replace({ ...actor, slot: "featured_artists", ids: ["a", "a"] }),
    ).rejects.toMatchObject({ issues: [{ index: 1, reason: "duplicate" }] });
  });

  it("refuses an original in the prints and an artist id in the categories", async () => {
    const { service, add } = createInMemoryHomeFeatures();
    add({ kind: "artwork", id: "original", isShopEdition: false }, artist("a"));
    await expect(
      service.replace({ ...actor, slot: "featured_prints", ids: ["original"] }),
    ).rejects.toMatchObject({ issues: [{ index: 0, reason: "not_a_shop_edition" }] });
    await expect(
      service.replace({ ...actor, slot: "featured_categories", ids: ["a"] }),
    ).rejects.toMatchObject({ issues: [{ index: 0, reason: "unknown" }] });
  });

  it("replays a repeated key without writing again", async () => {
    const { service, add, writes, audit } = createInMemoryHomeFeatures();
    add(artist("a"));
    const first = await service.replace({ ...actor, slot: "featured_artists", ids: ["a"] });
    const again = await service.replace({ ...actor, slot: "featured_artists", ids: ["a"] });
    expect(again).toEqual(first);
    expect(writes).toHaveLength(1);
    expect(audit).toHaveLength(1);
  });
});

describe("HomeFeaturesService reads", () => {
  it("lists and searches through the list reader", async () => {
    const list = vi.fn(async () => EMPTY_HOME_FEATURES);
    const searchCandidates = vi.fn(async () => []);
    const service = createHomeFeaturesService({
      uow: { run: () => Promise.reject(new Error("no writes")) },
      lists: { list, searchCandidates },
      clock: { now: () => NOW },
    });
    await expect(service.list()).resolves.toEqual(EMPTY_HOME_FEATURES);
    await service.searchCandidates("featured_prints", { q: "vessel", limit: 10 });
    expect(searchCandidates).toHaveBeenCalledWith("featured_prints", { q: "vessel", limit: 10 });
  });
});

describe("Featured on home contract", () => {
  it("lists the domain's slots and issue reasons", () => {
    expect([...ADMIN_HOME_FEATURE_SLOT_VALUES]).toEqual([...HOME_FEATURE_SLOTS]);
    const reasons = AdminHomeFeatureIssueSchema.properties.reason.anyOf.map(
      (literal) => literal.const,
    );
    const domainReasons: Record<HomeFeatureIssueReason, true> = {
      unknown: true,
      duplicate: true,
      not_a_shop_edition: true,
      over_limit: true,
    };
    expect(reasons.sort()).toEqual(Object.keys(domainReasons).sort());
  });
});
