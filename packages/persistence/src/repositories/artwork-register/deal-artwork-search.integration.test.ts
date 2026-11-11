import type { NewArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { type Database, createDb } from "@auction/db";
import { legalEntity, lot, sale, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleDealArtworkSearchReader,
  DrizzleOpenLotPlaceReader,
} from "./index.js";

const url = process.env.DATABASE_URL;
const NOW = new Date("2026-11-11T09:00:00.000Z");

class Rollback extends Error {}

/** Runs a test inside a transaction that is always undone, so the shared database stays clean. */
async function inRollback(run: (tx: Database) => Promise<void>): Promise<void> {
  const db = createDb(url as string);
  try {
    await db.transaction(async (tx) => {
      await run(tx as unknown as Database);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

function newEntry(
  n: number,
  overrides: Partial<NewArtworkRegisterEntry> = {},
): NewArtworkRegisterEntry {
  const code = String(9000 + n);
  return {
    zohoProductId: `pd1-${code}`,
    stockCode: `LAX-ORI-PX-GAC-26-${code}`,
    kind: "original",
    sourceOriginalId: null,
    title: `Picker work ${n}`,
    artist: { zohoArtistId: null, name: "Pia Xavier", code: "PX" },
    medium: "Oil on canvas",
    dimensions: "60 x 80 cm",
    year: 2024,
    imageRefs: [],
    catalogueStatus: "Available",
    ...overrides,
  };
}

/** The shared database may hold other tests' artworks; only the ones seeded here are compared. */
const seededOnly = <T extends { stockCode: string }>(rows: T[]) =>
  rows.filter((row) => row.stockCode.startsWith("LAX-ORI-PX-GAC-26-9"));

async function seed(tx: Database, entries: NewArtworkRegisterEntry[]) {
  const repo = new DrizzleArtworkRegisterRepository(tx);
  const created = [];
  for (const entry of entries) {
    const result = await repo.create(entry, "system", NOW);
    if (!result.ok) throw new Error(result.reason);
    created.push(result.entry);
  }
  return created;
}

describe.skipIf(!url)(
  "choosing a deal's artwork from the register (Postgres)",
  { timeout: 30_000 },
  () => {
    it("returns originals only, never prints", async () => {
      await inRollback(async (tx) => {
        const [original] = await seed(tx, [newEntry(1)]);
        await seed(tx, [
          newEntry(2, {
            kind: "print",
            stockCode: "LAX-PRT-PX-GAC-26-9001",
            sourceOriginalId: original?.id ?? null,
            zohoProductId: "pd1-print",
            title: "Picker work 1",
          }),
        ]);
        const found = await new DrizzleDealArtworkSearchReader(tx).searchOriginals({
          text: "Picker work",
          limit: 20,
        });
        expect(found.map((e) => e.stockCode)).toEqual(["LAX-ORI-PX-GAC-26-9001"]);
      });
    });

    it("matches the title, the artist and the stock code, ignoring case", async () => {
      await inRollback(async (tx) => {
        await seed(tx, [
          newEntry(1, { title: "Harbour at dusk" }),
          newEntry(2, {
            title: "Quarry",
            artist: { zohoArtistId: null, name: "Omar Reyes", code: "OR" },
          }),
        ]);
        const reader = new DrizzleDealArtworkSearchReader(tx);
        const titles = async (text: string) =>
          seededOnly(await reader.searchOriginals({ text, limit: 20 }))
            .map((e) => e.title)
            .sort();
        expect(await titles("HARBOUR")).toEqual(["Harbour at dusk"]);
        expect(await titles("reyes")).toEqual(["Quarry"]);
        expect(await titles("9001")).toEqual(["Harbour at dusk"]);
        expect(await titles("LAX-ORI-PX-GAC-26-9002")).toEqual(["Quarry"]);
        expect(await titles("nothing like it")).toEqual([]);
      });
    });

    it("reads % and _ in typed text as ordinary characters", async () => {
      await inRollback(async (tx) => {
        await seed(tx, [newEntry(1, { title: "100% cotton" }), newEntry(2, { title: "Study 1" })]);
        const reader = new DrizzleDealArtworkSearchReader(tx);
        expect(
          (await reader.searchOriginals({ text: "%", limit: 20 })).map((e) => e.title),
        ).toEqual(["100% cotton"]);
        expect(
          (await reader.searchOriginals({ text: "_", limit: 20 })).map((e) => e.title),
        ).toEqual([]);
      });
    });

    it("lists matches to the enquiry first, then by title, and respects the limit", async () => {
      await inRollback(async (tx) => {
        await seed(tx, [
          newEntry(1, {
            title: "Aardvark",
            artist: { zohoArtistId: null, name: "Other", code: "OT" },
          }),
          newEntry(2, { title: "Harbour at dusk" }),
          newEntry(3, { title: "Zinc" }),
          newEntry(4, {
            title: "Harbour at dawn",
            artist: { zohoArtistId: null, name: "Other", code: "OT" },
          }),
        ]);
        const reader = new DrizzleDealArtworkSearchReader(tx);
        const suggest = { artist: "Pia Xavier", title: "Harbour at dusk" };
        const found = await reader.searchOriginals({ text: "", suggest, limit: 500 });
        const titles = seededOnly(found).map((e) => e.title);
        // Artist and title both match, then one of them, then the rest by title.
        expect(titles).toEqual(["Harbour at dusk", "Zinc", "Aardvark", "Harbour at dawn"]);
        expect(await reader.searchOriginals({ text: "", suggest, limit: 2 })).toHaveLength(2);
      });
    });

    it("returns the lot that holds an artwork's place, one per artwork, and ignores finished lots", async () => {
      await inRollback(async (tx) => {
        const [held, scheduled, ended] = await seed(tx, [newEntry(1), newEntry(2), newEntry(3)]);
        const ids = {
          user: "pd1-picker-seller",
          entity: "b9e00000-0000-4000-8000-000000000001",
          sale: "b9e00000-0000-4000-8000-000000000010",
        };
        await tx.insert(user).values({
          id: ids.user,
          name: "Seller",
          email: "pd1-picker-seller@integration.test",
          emailVerified: true,
          createdAt: NOW,
          updatedAt: NOW,
        });
        await tx.insert(legalEntity).values({
          id: ids.entity,
          displayName: "Gallery",
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: ids.user,
          status: "approved",
          createdAt: NOW,
          updatedAt: NOW,
        });
        await tx.insert(sale).values({
          id: ids.sale,
          title: "Winter Prints",
          status: "draft",
          startTime: new Date("2026-12-01T10:00:00Z"),
          endTime: new Date("2026-12-10T18:00:00Z"),
          createdByLegalEntityId: ids.entity,
        });
        const lotRow = (
          registerId: string | undefined,
          n: number,
          status: "draft" | "scheduled" | "ended",
        ) => ({
          saleId: ids.sale,
          lotNumber: n,
          title: `Lot ${n}`,
          sellerLegalEntityId: ids.entity,
          artworkRegisterId: registerId ?? null,
          auctionType: "english" as const,
          startingPrice: "100",
          currentPrice: "100",
          status,
          startTime: new Date("2026-12-01T10:00:00Z"),
          endTime: new Date("2026-12-10T18:00:00Z"),
        });
        await tx
          .insert(lot)
          .values([lotRow(scheduled?.id, 12, "scheduled"), lotRow(ended?.id, 13, "ended")]);

        const places = await new DrizzleOpenLotPlaceReader(tx).listOpenLotPlaces([
          held?.id as string,
          scheduled?.id as string,
          ended?.id as string,
        ]);
        expect(places).toEqual([
          expect.objectContaining({
            registerId: scheduled?.id,
            lotNumber: 12,
            saleTitle: "Winter Prints",
            status: "scheduled",
          }),
        ]);
        expect(await new DrizzleOpenLotPlaceReader(tx).listOpenLotPlaces([])).toEqual([]);
      });
    });
  },
);
