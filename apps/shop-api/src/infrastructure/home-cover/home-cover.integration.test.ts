import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { shopHomeCover, shopMediaAsset } from "@auction/db/schema";
import { assembleCoverAnalysis } from "@auction/domain";
import { eq } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HomeCoverRecord } from "../../application/home-cover/home-cover.ports.js";
import { createFakeObjectStorage } from "../../test-support/fake-object-storage.js";
import { CALM_DARK_ZONES } from "../../test-support/in-memory-home-cover.js";
import { createDrizzleHomeCoverPictures } from "./drizzle-home-cover.pictures.js";
import { createDrizzleHomeCoverStore, readHomeCover } from "./drizzle-home-cover.store.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

const record = (mediaKey: string): HomeCoverRecord => ({
  mediaKey,
  width: 3200,
  height: 1600,
  blurDataUrl: "data:image/webp;base64,AAAA",
  focal: { x: 0.7, y: 0.4 },
  alt: "A river at dusk",
  analysis: assembleCoverAnalysis(
    {
      dominant: [24, 28, 40],
      deepest: [12, 14, 20],
      blurDataURL: "data:image/webp;base64,AAAA",
      zones: { desktop: CALM_DARK_ZONES, wide: CALM_DARK_ZONES },
    },
    "left",
  ),
});

describe.skipIf(!ownerUrl || !shopUrl)("drizzle home cover (as shop_app)", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl || !shopUrl) throw new Error("Shop integration database URLs are required");
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    shopPool = new pg.Pool({ connectionString: shopUrl });
    await applyApplicationRoleGrants(ownerUrl);
  });

  afterAll(async () => {
    await createDbFromPool(shopPool).delete(shopHomeCover);
    await ownerPool.end();
    await shopPool.end();
  });

  it("saves, reads back, replaces and clears the one cover row", async () => {
    const db = createDbFromPool(shopPool);
    const store = createDrizzleHomeCoverStore(db);
    await store.clear();
    expect(await readHomeCover(db)).toBeNull();

    const at = new Date("2026-11-12T10:00:00.000Z");
    await store.save(record("shop/artwork/one.jpg"), "staff-1", at);
    await store.save(record("shop/artwork/two.jpg"), "staff-2", at);

    const saved = await readHomeCover(db);
    expect(saved).toMatchObject({
      mediaKey: "shop/artwork/two.jpg",
      width: 3200,
      focal: { x: 0.7, y: 0.4 },
      alt: "A river at dusk",
      updatedAt: at.toISOString(),
    });
    expect(saved?.analysis.breakpoints.desktop?.recommended).toBe("light");
    const rows = await db.select().from(shopHomeCover);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.updatedBySubjectId).toBe("staff-2");

    await store.clear();
    expect(await readHomeCover(db)).toBeNull();
  });

  it("refuses a second row, an out-of-range focal point and an empty alt", async () => {
    const db = createDbFromPool(shopPool);
    const store = createDrizzleHomeCoverStore(db);
    const at = new Date();
    await expect(
      store.save({ ...record("k"), focal: { x: 1.2, y: 0.5 } }, "s", at),
    ).rejects.toThrow();
    await expect(store.save({ ...record("k"), alt: "" }, "s", at)).rejects.toThrow();
    await expect(
      db
        .insert(shopHomeCover)
        .values({ id: "other", ...record("k"), focalX: 0.5, focalY: 0.5, blurDataUrl: null }),
    ).rejects.toThrow();
  });

  it("reads only the Shop's own pictures from storage", async () => {
    const db = createDbFromPool(shopPool);
    const storage = createFakeObjectStorage();
    const suffix = crypto.randomUUID();
    const upload = `shop/editorial-cover/${suffix}.jpg`;
    const application = `shop/application/${suffix}.jpg`;
    const stray = `private/${suffix}.jpg`;
    const pending = `shop/editorial-cover/pending-${suffix}.jpg`;
    const rejected = `shop/editorial-cover/rejected-${suffix}.jpg`;
    for (const key of [upload, application, stray, pending, rejected]) {
      await storage.putObject(key, Buffer.from(key), "image/jpeg");
    }
    await db.insert(shopMediaAsset).values([
      {
        key: upload,
        kind: "editorial_cover",
        status: "active",
        contentType: "image/jpeg",
        byteSize: upload.length,
      },
      {
        key: application,
        kind: "artist_application_image",
        status: "active",
        contentType: "image/jpeg",
        byteSize: application.length,
      },
      {
        key: pending,
        kind: "editorial_cover",
        status: "pending",
        contentType: "image/jpeg",
        byteSize: pending.length,
      },
      {
        key: rejected,
        kind: "editorial_cover",
        status: "rejected",
        contentType: "image/jpeg",
        byteSize: rejected.length,
      },
    ]);
    const pictures = createDrizzleHomeCoverPictures(db, {
      storage,
      resolveMediaUrl: (value) => (value ? storage.getPublicUrl(value) : null),
    });

    expect((await pictures.load(upload))?.toString()).toBe(upload);
    expect(await pictures.load(application)).toBeNull();
    expect(await pictures.load(stray)).toBeNull();
    expect(await pictures.load(pending)).toBeNull();
    expect(await pictures.load(rejected)).toBeNull();
    expect(await pictures.load(`shop/editorial-cover/missing-${suffix}.jpg`)).toBeNull();

    await db.delete(shopMediaAsset).where(eq(shopMediaAsset.key, upload));
    await db.delete(shopMediaAsset).where(eq(shopMediaAsset.key, application));
    await db.delete(shopMediaAsset).where(eq(shopMediaAsset.key, pending));
    await db.delete(shopMediaAsset).where(eq(shopMediaAsset.key, rejected));
  });

  it("lists pictures of live Shop editions for staff to choose from", async () => {
    const db = createDbFromPool(shopPool);
    const pictures = createDrizzleHomeCoverPictures(db, {
      storage: null,
      resolveMediaUrl: (value) => (value ? `https://media.test/${value}` : null),
    });
    const rows = await pictures.search({ limit: 5 });
    for (const row of rows) {
      expect(row.imageUrl).toBe(`https://media.test/${row.mediaKey}`);
    }
    expect(rows.length).toBeLessThanOrEqual(5);
  });
});
