import type { ArtworkRegisterEntry, OfferState } from "@auction/artwork-register-contracts";
import type { RegisterStatusSource } from "@auction/persistence/interfaces";
import { vi } from "vitest";
import type {
  ZohoStatusProducts,
  ZohoStatusState,
} from "../integrations/zoho/artwork/status/zoho-status-products.js";
import {
  ZohoStatusSync,
  type ZohoStatusSyncMode,
} from "../integrations/zoho/artwork/status/zoho-status-sync.js";

export const NOW = new Date("2026-11-03T12:00:00.000Z");
export const REGISTER_ID = "6f1c1d0e-0000-4000-8000-000000000001";
export const PRODUCT_ID = "5000000000001000001";

export function entry(overrides: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry {
  return {
    id: REGISTER_ID,
    zohoProductId: PRODUCT_ID,
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    kind: "original",
    sourceOriginalId: null,
    title: "Harbour at dusk",
    artist: { zohoArtistId: "5000000000000077001", name: "Aidan Phelan", code: "PH" },
    medium: "Oil on canvas",
    dimensions: "60 x 80 cm",
    year: 2024,
    imageRefs: [],
    catalogueStatus: "Available",
    zohoPrice: "4200.00",
    offer: { state: "held", ref: null },
    zohoModifiedAt: new Date("2026-09-01T00:00:00.000Z"),
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    version: 1,
    ...overrides,
  };
}

export function inState(state: OfferState): ArtworkRegisterEntry {
  const ref = {
    lax_art: { kind: "shop_artwork", id: "a-1" },
    bid_sale: { kind: "bid_lot", id: "lot-1" },
    private_sale: { kind: "private_sale", id: "deal-1" },
  } as const;
  return entry({
    offer: { state, ref: state in ref ? ref[state as keyof typeof ref] : null },
  });
}

export type FakeWorld = {
  /** The Zoho Product: what it shows now. Undefined means the Product is gone. */
  zoho: ZohoStatusState | undefined;
  /** The register: its entry, the Status LAX last wrote, the open Status conflict. */
  source: RegisterStatusSource | null;
  written: string | null;
  conflict: { zohoStatus: string; laxStatus: string } | null;
};

/** A Zoho Product and a register in memory, behind the ports the sync uses. */
export function fakeWorld(initial: Partial<FakeWorld> & { zohoStatus?: string | null } = {}) {
  const world: FakeWorld = {
    zoho:
      "zoho" in initial
        ? initial.zoho
        : {
            status: initial.zohoStatus === undefined ? "Available" : initial.zohoStatus,
            modifiedAt: null,
          },
    source: "source" in initial ? (initial.source ?? null) : { entry: entry(), lastMove: null },
    written: initial.written ?? null,
    conflict: initial.conflict ?? null,
  };
  const products: ZohoStatusProducts & {
    read: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  } = {
    read: vi.fn(async (ids: readonly string[]) =>
      world.zoho && ids.includes(PRODUCT_ID) ? new Map([[PRODUCT_ID, world.zoho]]) : new Map(),
    ),
    write: vi.fn(async (_id: string, status: string) => {
      if (world.zoho) world.zoho = { ...world.zoho, status };
    }),
  };
  const register = {
    findCatalogueStatusLedgers: vi.fn(async () =>
      world.source
        ? new Map([
            [REGISTER_ID, { written: world.written, conflictOpen: world.conflict !== null }],
          ])
        : new Map(),
    ),
    recordCatalogueStatusWritten: vi.fn(async (input: { status: string }) => {
      world.written = input.status;
      world.conflict = null;
      // The register's copy of Zoho's Status follows what LAX wrote, as the repository does.
      if (world.source) {
        world.source = {
          ...world.source,
          entry: { ...world.source.entry, catalogueStatus: input.status },
        };
      }
      return { status: "recorded" as const };
    }),
    closeCatalogueStatusConflict: vi.fn(async () => {
      const closed = world.conflict !== null;
      world.conflict = null;
      return { closed };
    }),
    recordCatalogueStatusConflict: vi.fn(
      async (input: { zohoStatus: string; laxStatus: string }) => {
        world.conflict = { zohoStatus: input.zohoStatus, laxStatus: input.laxStatus };
        return { status: "recorded" as const };
      },
    ),
  };
  const sources = {
    readStatusSources: vi.fn(async () => (world.source ? [world.source] : [])),
  };
  const lock = {
    withLock: vi.fn(async (_ids: readonly string[], fn: () => Promise<never>) => fn()),
  };
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const sync = (mode: ZohoStatusSyncMode = "live", now: () => Date = () => NOW) =>
    new ZohoStatusSync({
      mode,
      sources,
      register,
      products,
      lock: lock as never,
      log: log as never,
      now,
    });
  return { world, products, register, sources, lock, log, sync };
}
