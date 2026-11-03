import { createDb, mediaAsset } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadMediaAssetSizes, mediaAssetSizeQuery } from "./media-asset-sizes.js";

describe("mediaAssetSizeQuery", () => {
  // The pool never connects: the query is only compiled.
  const db = createDb("postgresql://u:p@127.0.0.1:1/none");

  it("binds each key on its own, never as a row cast to text[]", () => {
    const { sql: text, params } = mediaAssetSizeQuery(db, ["a.jpg", "b.jpg"]).toSQL();
    expect(text).toMatch(/"media_asset"\."key" in \(\$1, \$2\)/);
    expect(text).not.toContain("::text[]");
    expect(params).toEqual(["a.jpg", "b.jpg"]);
  });
});

const databaseUrl = process.env.WORKER_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("loadMediaAssetSizes against postgres", () => {
  const db = createDb(databaseUrl ?? "postgresql://u:p@127.0.0.1:1/none");

  beforeAll(async () => {
    await db.execute(sql`drop table if exists media_asset`);
    await db.execute(sql`create table media_asset (
      key text primary key, width integer not null, height integer not null,
      blur_data_url text not null, variants jsonb, processed_at timestamptz not null default now())`);
    await db.insert(mediaAsset).values([
      { key: "a.jpg", width: 2400, height: 1200, blurDataURL: "x" },
      { key: "b.jpg", width: 800, height: 600, blurDataURL: "x" },
    ]);
  });

  afterAll(async () => {
    await db.execute(sql`drop table if exists media_asset`);
    await (db as unknown as { $client: { end(): Promise<void> } }).$client.end();
  });

  it("returns the measured keys and leaves out the unknown ones", async () => {
    const sizes = await loadMediaAssetSizes(db, ["a.jpg", "b.jpg", "a.jpg", "missing.jpg"]);
    expect([...sizes.keys()].sort()).toEqual(["a.jpg", "b.jpg"]);
    expect(sizes.get("a.jpg")).toEqual({ key: "a.jpg", width: 2400, height: 1200 });
  });

  it("returns nothing for no keys", async () => {
    expect((await loadMediaAssetSizes(db, [])).size).toBe(0);
  });
});
