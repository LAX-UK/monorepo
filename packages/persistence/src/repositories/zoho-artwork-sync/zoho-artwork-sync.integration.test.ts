import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { ZohoArtworkSyncOutcomeInput } from "../../interfaces/zoho-artwork-sync.js";
import { DrizzleZohoArtworkSyncStore } from "./index.js";

const url = process.env.DATABASE_URL;
const db = url ? createDb(url) : (null as never);

const T0 = new Date("2026-11-03T02:30:00.000Z");
const T1 = new Date("2026-11-03T03:30:00.000Z");

function outcome(
  overrides: Partial<ZohoArtworkSyncOutcomeInput> = {},
): ZohoArtworkSyncOutcomeInput {
  return {
    zohoProductId: "5001",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    title: "Harbour at dusk",
    outcome: "create",
    reason: null,
    detail: { gaps: ["missing_price"] },
    zohoModifiedAt: T0,
    ...overrides,
  };
}

describe.skipIf(!url)("Zoho artwork sync store (Postgres)", { timeout: 30_000 }, () => {
  const store = new DrizzleZohoArtworkSyncStore(db);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE zoho_artwork_sync_outcome, zoho_artwork_sync_state`);
  });

  it("has no watermark before the first pass finishes", async () => {
    expect(await store.get("dry_run")).toBeNull();
  });

  it("moves the watermark forward only, and keeps one per mode", async () => {
    await store.advance("dry_run", T1, T1);
    await store.advance("dry_run", T0, T1);
    expect(await store.get("dry_run")).toEqual(T1);
    expect(await store.get("live")).toBeNull();
    await store.advance("live", T0, T1);
    expect(await store.get("live")).toEqual(T0);
  });

  it("records a result per Product and replaces it when the same pass records it again", async () => {
    await store.record(
      "nightly:dry_run:2026-11-03",
      "dry_run",
      [outcome(), outcome({ zohoProductId: "5002", outcome: "skipped", reason: "demo_artist" })],
      T0,
    );
    await store.record(
      "nightly:dry_run:2026-11-03",
      "dry_run",
      [outcome({ outcome: "update", detail: { changes: { title: { from: "a", to: "b" } } } })],
      T1,
    );

    const rows = await store.listForRun("nightly:dry_run:2026-11-03", 10);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.zohoProductId === "5001")).toMatchObject({
      outcome: "update",
      detail: { changes: { title: { from: "a", to: "b" } } },
      recordedAt: T1,
    });
    expect(await store.summarise("nightly:dry_run:2026-11-03")).toEqual({
      create: 0,
      update: 1,
      conflict: 0,
      unchanged: 0,
      stale: 0,
      skipped: 1,
    });
  });

  it("keeps the same Product's results in different passes apart", async () => {
    await store.record("notice:a", "dry_run", [outcome()], T0);
    await store.record("notice:b", "dry_run", [outcome({ outcome: "stale" })], T1);
    expect(await store.listForRun("notice:a", 10)).toHaveLength(1);
    expect((await store.summarise("notice:b")).stale).toBe(1);
  });
});
