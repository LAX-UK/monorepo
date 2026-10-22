import crypto from "node:crypto";
import {
  shopAdminAudit,
  shopArtist,
  shopArtwork,
  shopEditorialExhibition,
  shopEditorialExhibitionArtwork,
  shopEditorialStory,
} from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEditorialLinksService } from "../application/editorial-links.service.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleArtworkImportRepository } from "./drizzle-artwork-import.repository.js";
import { createDrizzleEditorialLinksRepository } from "./drizzle-editorial-links.repository.js";
import { createEditorialRelationQueries } from "./drizzle-editorial-relations.js";
import { createDrizzleSaleAuthorityWriter } from "./drizzle-sale-authority.writer.js";
import { seedShopFoundationCatalogue } from "./seed/catalogue-seed.js";
import { seedEditorialShowcase } from "./seed/editorial-showcase-seed.js";

const ACTOR = "links-test-editor";
const FAILING_ACTOR = "links-audit-fails";
const resolveMediaUrl = (value: string | null | undefined) => value ?? null;

describe.skipIf(!hasShopIntegrationDb)("editorial links repository", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;
  const token = crypto.randomUUID().slice(0, 8);
  const ids = {
    artworks: [] as string[],
    artworkSlugs: ["quiet-orchard", "tidal-forms", "harbour-light", "marylebone-dusk"],
    artists: [] as string[],
    artistSlugs: ["art-foundation-artist", "ines-okafor", "theo-marsh"],
    exhibitionA: "",
    exhibitionB: "",
    storyA: "",
    storyB: "",
  };

  function setup() {
    const db = createShopDb(shopPool);
    const repo = createDrizzleEditorialLinksRepository(db, { resolveMediaUrl });
    return { db, repo, service: createEditorialLinksService(repo) };
  }

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    const db = createShopDb(shopPool);
    await seedShopFoundationCatalogue(
      createDrizzleArtworkImportRepository(db, "off").importArtwork,
      db,
      createDrizzleSaleAuthorityWriter(db, "off").grantSaleAuthority,
    );
    await seedEditorialShowcase(db);

    const artworkRows = await db
      .select({ id: shopArtwork.id, slug: shopArtwork.slug })
      .from(shopArtwork)
      .where(inArray(shopArtwork.slug, ids.artworkSlugs));
    ids.artworks = ids.artworkSlugs.map(
      (slug) => artworkRows.find((r) => r.slug === slug)?.id ?? "",
    );
    const artistRows = await db
      .select({ id: shopArtist.id, slug: shopArtist.slug })
      .from(shopArtist)
      .where(inArray(shopArtist.slug, ids.artistSlugs));
    ids.artists = ids.artistSlugs.map((slug) => artistRows.find((r) => r.slug === slug)?.id ?? "");
    expect([...ids.artworks, ...ids.artists].every(Boolean)).toBe(true);

    const exhibitions = await db
      .insert(shopEditorialExhibition)
      .values([
        { slug: `it-links-ex-a-${token}`, kind: "exhibition", title: `Links A ${token}` },
        {
          slug: `it-links-ex-b-${token}`,
          kind: "exhibition",
          title: `Links B ${token}`,
          status: "published",
        },
      ])
      .returning({ id: shopEditorialExhibition.id, slug: shopEditorialExhibition.slug });
    ids.exhibitionA = exhibitions.find((r) => r.slug.includes("ex-a"))?.id ?? "";
    ids.exhibitionB = exhibitions.find((r) => r.slug.includes("ex-b"))?.id ?? "";
    const stories = await db
      .insert(shopEditorialStory)
      .values([
        {
          slug: `it-links-story-a-${token}`,
          kind: "article",
          title: `100% Links ${token}`,
          status: "published",
          publishedAt: new Date("2026-02-01T00:00:00Z"),
        },
        {
          slug: `it-links-story-b-${token}`,
          kind: "article",
          title: `100_ Links ${token}`,
          status: "published",
          publishedAt: new Date("2026-03-01T00:00:00Z"),
        },
      ])
      .returning({ id: shopEditorialStory.id, slug: shopEditorialStory.slug });
    ids.storyA = stories.find((r) => r.slug.includes("story-a"))?.id ?? "";
    ids.storyB = stories.find((r) => r.slug.includes("story-b"))?.id ?? "";

    // Trigger lets one test force the audit insert to fail without touching production code.
    await ownerPool.query(`
      create or replace function it_links_fail_audit() returns trigger as $$
      begin raise exception 'forced audit failure'; end $$ language plpgsql;
      drop trigger if exists it_links_fail_audit on shop_admin_audit;
      create trigger it_links_fail_audit before insert on shop_admin_audit
        for each row when (new.actor_subject_id = '${FAILING_ACTOR}')
        execute function it_links_fail_audit();
    `);
  });

  afterAll(async () => {
    const db = createShopDb(ownerPool);
    await ownerPool.query("drop trigger if exists it_links_fail_audit on shop_admin_audit");
    await ownerPool.query("drop function if exists it_links_fail_audit()");
    await db
      .delete(shopEditorialExhibition)
      .where(inArray(shopEditorialExhibition.id, [ids.exhibitionA, ids.exhibitionB]));
    await db
      .delete(shopEditorialStory)
      .where(inArray(shopEditorialStory.id, [ids.storyA, ids.storyB]));
    await shopPool.end();
    await ownerPool.end();
  });

  async function exhibitionVersion(exhibitionId: string): Promise<string> {
    const links = await setup().repo.getExhibitionLinks(exhibitionId);
    return links?.version ?? "";
  }

  it("replaces and reorders artworks, and the public page shows the new order", async () => {
    const { db, repo } = setup();
    const [a, b, c] = ids.artworks as [string, string, string];
    const first = await repo.replaceExhibitionLinks({
      parentId: ids.exhibitionA,
      list: "artworks",
      ids: [b, a, c],
      expectedVersion: await exhibitionVersion(ids.exhibitionA),
      actorSubjectId: ACTOR,
    });
    expect(first.status).toBe("replaced");

    const read = await repo.getExhibitionLinks(ids.exhibitionA);
    expect(read?.artworks.map((item) => item.slug)).toEqual([
      "tidal-forms",
      "quiet-orchard",
      "harbour-light",
    ]);
    expect(read?.artworks[0]).toMatchObject({ published: true, thumbnailUrl: expect.anything() });
    if (first.status === "replaced") expect(read?.version).toBe(first.version);

    const reordered = await repo.replaceExhibitionLinks({
      parentId: ids.exhibitionA,
      list: "artworks",
      ids: [c, b],
      expectedVersion: first.status === "replaced" ? first.version : "",
      actorSubjectId: ACTOR,
    });
    expect(reordered.status).toBe("replaced");
    const rows = await db
      .select()
      .from(shopEditorialExhibitionArtwork)
      .where(eq(shopEditorialExhibitionArtwork.exhibitionId, ids.exhibitionA));
    expect(rows.map((r) => r.position).sort()).toEqual([0, 1]);

    const publicRead = await createEditorialRelationQueries(
      db,
      resolveMediaUrl,
    ).exhibitionRelations(ids.exhibitionA);
    expect(publicRead.artworks.map((work) => work.slug)).toEqual(["harbour-light", "tidal-forms"]);
  });

  it("orders artists by the written position on exhibitions and stories", async () => {
    const { db, repo } = setup();
    const [x, y, z] = ids.artists as [string, string, string];
    const order = [z, x, y];
    const exhibition = await repo.replaceExhibitionLinks({
      parentId: ids.exhibitionA,
      list: "artists",
      ids: order,
      expectedVersion: await exhibitionVersion(ids.exhibitionA),
      actorSubjectId: ACTOR,
    });
    expect(exhibition.status).toBe("replaced");
    const story = await repo.replaceStoryLinks({
      parentId: ids.storyA,
      list: "artists",
      ids: order,
      expectedVersion: (await repo.getStoryLinks(ids.storyA))?.version ?? "",
      actorSubjectId: ACTOR,
    });
    expect(story.status).toBe("replaced");

    const queries = createEditorialRelationQueries(db, resolveMediaUrl);
    const slugs = ["theo-marsh", "art-foundation-artist", "ines-okafor"];
    expect((await queries.exhibitionRelations(ids.exhibitionA)).artists.map((a) => a.slug)).toEqual(
      slugs,
    );
    expect((await queries.storyRelations(ids.storyA)).artists.map((a) => a.slug)).toEqual(slugs);
  });

  it("refuses a stale version with the current one and writes nothing", async () => {
    const { repo } = setup();
    const [a] = ids.artworks as [string];
    const stale = await exhibitionVersion(ids.exhibitionB);
    await repo.replaceExhibitionLinks({
      parentId: ids.exhibitionB,
      list: "artworks",
      ids: [a],
      expectedVersion: stale,
      actorSubjectId: ACTOR,
    });
    const current = await exhibitionVersion(ids.exhibitionB);
    expect(current).not.toBe(stale);

    const outcome = await repo.replaceExhibitionLinks({
      parentId: ids.exhibitionB,
      list: "artworks",
      ids: [],
      expectedVersion: stale,
      actorSubjectId: ACTOR,
    });
    expect(outcome).toEqual({ status: "stale", currentVersion: current });
    expect((await repo.getExhibitionLinks(ids.exhibitionB))?.artworks).toHaveLength(1);
  });

  it("reports which ids are unknown and writes nothing", async () => {
    const { repo } = setup();
    const missing = "99999999-9999-4999-8999-999999999999";
    const before = await exhibitionVersion(ids.exhibitionA);
    const outcome = await repo.replaceExhibitionLinks({
      parentId: ids.exhibitionA,
      list: "artworks",
      ids: [ids.artworks[0] ?? "", missing],
      expectedVersion: before,
      actorSubjectId: ACTOR,
    });
    expect(outcome).toEqual({ status: "unknown_ids", missingIds: [missing] });
    expect(await exhibitionVersion(ids.exhibitionA)).toBe(before);
  });

  it("returns parent_not_found for a missing parent and null reads", async () => {
    const { repo } = setup();
    const missing = "88888888-8888-4888-8888-888888888888";
    expect(await repo.getExhibitionLinks(missing)).toBeNull();
    expect(await repo.getStoryLinks(missing)).toBeNull();
    expect(
      await repo.replaceStoryLinks({
        parentId: missing,
        list: "artworks",
        ids: [],
        expectedVersion: "x",
        actorSubjectId: ACTOR,
      }),
    ).toEqual({ status: "parent_not_found" });
  });

  it("writes an audit row with the before and after ids in the same transaction", async () => {
    const { db, repo } = setup();
    const before =
      (await repo.getExhibitionLinks(ids.exhibitionA))?.artworks.map((i) => i.id) ?? [];
    await repo.replaceExhibitionLinks({
      parentId: ids.exhibitionA,
      list: "artworks",
      ids: [ids.artworks[3] ?? ""],
      expectedVersion: await exhibitionVersion(ids.exhibitionA),
      actorSubjectId: ACTOR,
    });
    const rows = await db
      .select()
      .from(shopAdminAudit)
      .where(
        and(
          eq(shopAdminAudit.targetId, ids.exhibitionA),
          eq(shopAdminAudit.action, "editorial.exhibition.links.replace"),
        ),
      )
      .orderBy(shopAdminAudit.createdAt);
    const last = rows.at(-1);
    expect(last).toMatchObject({ actorSubjectId: ACTOR, capability: "editorial.write" });
    expect(JSON.parse(String(last?.afterJson))).toEqual({
      list: "artworks",
      ids: [ids.artworks[3]],
    });
    expect(JSON.parse(String(last?.beforeJson))).toEqual({ list: "artworks", ids: before });
  });

  it("rolls the whole write back when the audit insert fails", async () => {
    const { db, repo } = setup();
    const version = await exhibitionVersion(ids.exhibitionA);
    const [parentBefore] = await db
      .select({ updatedAt: shopEditorialExhibition.updatedAt })
      .from(shopEditorialExhibition)
      .where(eq(shopEditorialExhibition.id, ids.exhibitionA));
    await expect(
      repo.replaceExhibitionLinks({
        parentId: ids.exhibitionA,
        list: "artworks",
        ids: [ids.artworks[0] ?? "", ids.artworks[1] ?? ""],
        expectedVersion: version,
        actorSubjectId: FAILING_ACTOR,
      }),
    ).rejects.toThrow();
    expect(await exhibitionVersion(ids.exhibitionA)).toBe(version);
    const [parentAfter] = await db
      .select({ updatedAt: shopEditorialExhibition.updatedAt })
      .from(shopEditorialExhibition)
      .where(eq(shopEditorialExhibition.id, ids.exhibitionA));
    expect(parentAfter?.updatedAt).toEqual(parentBefore?.updatedAt);
  });

  it("keeps story and exhibition links consistent when edited from either side", async () => {
    const { db, repo } = setup();
    const queries = createEditorialRelationQueries(db, resolveMediaUrl);

    const fromExhibition = await repo.replaceExhibitionLinks({
      parentId: ids.exhibitionB,
      list: "stories",
      ids: [ids.storyA, ids.storyB],
      expectedVersion: await exhibitionVersion(ids.exhibitionB),
      actorSubjectId: ACTOR,
    });
    expect(fromExhibition.status).toBe("replaced");
    // Newest publication first, the order the public exhibition page uses.
    const stories = (await repo.getExhibitionLinks(ids.exhibitionB))?.stories ?? [];
    expect(stories.map((s) => s.id)).toEqual([ids.storyB, ids.storyA]);
    const storyLinks = await repo.getStoryLinks(ids.storyA);
    expect(storyLinks?.exhibitions.map((e) => e.id)).toEqual([ids.exhibitionB]);
    expect((await queries.storyRelations(ids.storyA)).exhibitions.map((e) => e.slug)).toEqual([
      `it-links-ex-b-${token}`,
    ]);

    const fromStory = await repo.replaceStoryLinks({
      parentId: ids.storyA,
      list: "exhibitions",
      ids: [],
      expectedVersion: storyLinks?.version ?? "",
      actorSubjectId: ACTOR,
    });
    expect(fromStory.status).toBe("replaced");
    expect((await repo.getExhibitionLinks(ids.exhibitionB))?.stories.map((s) => s.id)).toEqual([
      ids.storyB,
    ]);
    expect((await queries.exhibitionRelations(ids.exhibitionB)).stories.map((s) => s.slug)).toEqual(
      [`it-links-story-b-${token}`],
    );

    const addedFromStory = await repo.replaceStoryLinks({
      parentId: ids.storyA,
      list: "exhibitions",
      ids: [ids.exhibitionA, ids.exhibitionB],
      expectedVersion: (await repo.getStoryLinks(ids.storyA))?.version ?? "",
      actorSubjectId: ACTOR,
    });
    expect(addedFromStory.status).toBe("replaced");
    expect((await repo.getExhibitionLinks(ids.exhibitionA))?.stories.map((s) => s.id)).toEqual([
      ids.storyA,
    ]);
  });

  it("changes the other side's version when a shared story link changes", async () => {
    const { repo } = setup();
    const before = (await repo.getStoryLinks(ids.storyB))?.version ?? "";
    await repo.replaceExhibitionLinks({
      parentId: ids.exhibitionA,
      list: "stories",
      ids: [ids.storyA, ids.storyB],
      expectedVersion: await exhibitionVersion(ids.exhibitionA),
      actorSubjectId: ACTOR,
    });
    expect((await repo.getStoryLinks(ids.storyB))?.version).not.toBe(before);
  });

  it("matches candidates case-insensitively on title and slug, with wildcards taken literally", async () => {
    const { service } = setup();
    const byTitle = await service.searchCandidates({ kind: "story", q: `LINKS ${token}` });
    expect(byTitle.items.map((i) => i.id).sort()).toEqual([ids.storyA, ids.storyB].sort());

    const percent = await service.searchCandidates({ kind: "story", q: `100% links ${token}` });
    expect(percent.items.map((i) => i.id)).toEqual([ids.storyA]);

    const underscore = await service.searchCandidates({ kind: "story", q: `100_ links ${token}` });
    expect(underscore.items.map((i) => i.id)).toEqual([ids.storyB]);

    const bareWildcard = await service.searchCandidates({ kind: "story", q: `%${token}` });
    expect(bareWildcard.items).toEqual([]);

    const bySlug = await service.searchCandidates({
      kind: "exhibition",
      q: `IT-LINKS-EX-A-${token}`,
    });
    expect(bySlug.items).toEqual([
      {
        id: ids.exhibitionA,
        title: `Links A ${token}`,
        slug: `it-links-ex-a-${token}`,
        thumbnailUrl: null,
        published: false,
      },
    ]);
  });

  it("searches artists by display name and artworks by title", async () => {
    const { service } = setup();
    const artists = await service.searchCandidates({ kind: "artist", q: "theo" });
    expect(artists.items.map((i) => i.slug)).toContain("theo-marsh");
    const artworks = await service.searchCandidates({ kind: "artwork", q: "tidal" });
    expect(artworks.items.map((i) => i.slug)).toContain("tidal-forms");
  });

  it("pages candidates with a keyset cursor and stops at the end", async () => {
    const { service } = setup();
    const first = await service.searchCandidates({ kind: "story", q: token, limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).not.toBeNull();
    const second = await service.searchCandidates({
      kind: "story",
      q: token,
      limit: 1,
      ...(first.nextCursor ? { cursor: first.nextCursor } : {}),
    });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(new Set([first.items[0]?.id, second.items[0]?.id])).toEqual(
      new Set([ids.storyA, ids.storyB]),
    );
  });
});
