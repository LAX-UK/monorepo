import crypto from "node:crypto";
import { shopEditorialExhibition, shopEditorialStory } from "@auction/db/schema";
import { inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleEditorialSearchReader } from "./drizzle-editorial-search.reader.js";

describe.skipIf(!hasShopIntegrationDb)("editorial search reader", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;
  const token = crypto.randomUUID().slice(0, 8);
  const slugs = {
    pastExhibition: `it-search-past-${token}`,
    draftExhibition: `it-search-draft-${token}`,
    story: `it-search-story-${token}`,
    otherStory: `it-search-other-${token}`,
  };

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    const ownerDb = createShopDb(ownerPool);
    await ownerDb.insert(shopEditorialExhibition).values([
      {
        slug: slugs.pastExhibition,
        status: "published",
        kind: "exhibition",
        title: `Gilded ${token} Retrospective`,
        startsOn: "2020-01-01",
        endsOn: "2020-02-01",
      },
      {
        slug: slugs.draftExhibition,
        status: "draft",
        kind: "exhibition",
        title: `Gilded ${token} Draft`,
      },
    ]);
    await ownerDb.insert(shopEditorialStory).values([
      {
        slug: slugs.story,
        status: "published",
        kind: "article",
        title: "Collecting notes",
        standfirst: `On GILDED ${token} frames`,
      },
      {
        slug: slugs.otherStory,
        status: "published",
        kind: "article",
        title: `100% ${token}`,
      },
    ]);
  });

  afterAll(async () => {
    const ownerDb = createShopDb(ownerPool);
    await ownerDb
      .delete(shopEditorialExhibition)
      .where(inArray(shopEditorialExhibition.slug, [slugs.pastExhibition, slugs.draftExhibition]));
    await ownerDb
      .delete(shopEditorialStory)
      .where(inArray(shopEditorialStory.slug, [slugs.story, slugs.otherStory]));
    await shopPool.end();
    await ownerPool.end();
  });

  it("matches published past exhibitions by title, case-insensitively, and skips drafts", async () => {
    const reader = createDrizzleEditorialSearchReader(createShopDb(shopPool), {
      resolveMediaUrl: (value) => value ?? null,
    });
    const items = await reader.searchExhibitions(`gilded ${token}`);
    expect(items.map((item) => item.slug)).toEqual([slugs.pastExhibition]);
  });

  it("matches stories by standfirst and treats LIKE wildcards literally", async () => {
    const reader = createDrizzleEditorialSearchReader(createShopDb(shopPool), {
      resolveMediaUrl: (value) => value ?? null,
    });
    expect((await reader.searchStories(`gilded ${token}`)).map((item) => item.slug)).toEqual([
      slugs.story,
    ]);
    expect((await reader.searchStories(`0% ${token}`)).map((item) => item.slug)).toEqual([
      slugs.otherStory,
    ]);
    expect(await reader.searchStories(`_ ${token}`)).toEqual([]);
    expect(await reader.searchStories(`gilded ${token}`, "press")).toEqual([]);
  });
});
