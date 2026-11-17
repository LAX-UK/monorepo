/**
 * Fixture artworks for the stock location browser gate in LAX Admin (docs/design/stock-location.md),
 * so the e2e moves real artworks through the BFF and shop-api rather than only keeping the list:
 * three originals on the register and one active location, written through the same stores
 * shop-api uses, so each record has its `created` history entry and each move its
 * `location_moved` entry and `artwork_register.location_changed` event.
 *
 * - "Location fixture: first move" has no move: the spec opens its record and moves it.
 * - "Location fixture: to move" has no move: the spec moves it with "Move selected".
 * - "Location fixture: already there" is moved to the location here, so "Move selected" reports
 *   it as already there and its record's History reads "Location changed".
 *
 * Idempotent: the artworks are found by their fixed Zoho product id before any is created, the
 * location by its name (ignoring case, like the unique rule), and the seeded move is made only
 * when that artwork has none, so a second run changes nothing. The register is written as the
 * database owner and the records are made up, so this runs only on a hermetic local database
 * (marked "local" and at a local address), such as the CI stack.
 */
import type { NewArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { type Database, type SeedTargetEnv, assertSeedTarget } from "@auction/db";
import type {
  IArtworkRegisterRepository,
  IStockLocationStore,
} from "@auction/persistence/interfaces";

export const STOCK_LOCATION_E2E_SEED = "seed:stock-location";

/** Who the seeded location and move are by, as the history shows it. */
const ACTOR = `system:${STOCK_LOCATION_E2E_SEED}`;

/** The fixture artists' code: the e2e filters All artworks by it. */
export const STOCK_LOCATION_E2E_ARTIST_CODE = "ZLOC";

/** The seeded location. Unique to this seed, so the Locations spec's own names never meet it. */
export const STOCK_LOCATION_E2E_LOCATION = "E2E stock room";

export const STOCK_LOCATION_E2E_ARTWORKS = {
  firstMove: { zohoProductId: "e2e-stock-location-1", title: "Location fixture: first move" },
  toMove: { zohoProductId: "e2e-stock-location-2", title: "Location fixture: to move" },
  alreadyThere: { zohoProductId: "e2e-stock-location-3", title: "Location fixture: already there" },
} as const;

export type StockLocationE2eArtwork = keyof typeof STOCK_LOCATION_E2E_ARTWORKS;

function entryFor(key: StockLocationE2eArtwork, n: number): NewArtworkRegisterEntry {
  const artwork = STOCK_LOCATION_E2E_ARTWORKS[key];
  return {
    zohoProductId: artwork.zohoProductId,
    stockCode: `LAX-ORI-${STOCK_LOCATION_E2E_ARTIST_CODE}-E2E-26-${String(n).padStart(4, "0")}`,
    kind: "original",
    sourceOriginalId: null,
    title: artwork.title,
    artist: {
      zohoArtistId: null,
      name: "Stock Location Fixture",
      code: STOCK_LOCATION_E2E_ARTIST_CODE,
    },
    medium: "Oil on canvas",
    dimensions: "60 x 80 cm",
    year: 2026,
    imageRefs: [],
    catalogueStatus: "Available",
  };
}

/** The register and stock location stores on a connection or transaction; the script makes them. */
export type StockLocationE2eStoresOn = (session: Database) => {
  register: Pick<IArtworkRegisterRepository, "create" | "findByZohoProductId">;
  locations: IStockLocationStore;
};

export type StockLocationE2eSeedResult = {
  registerIds: Record<StockLocationE2eArtwork, string>;
  locationId: string;
  /** What this run wrote; empty on a second run. */
  created: string[];
};

export async function seedStockLocationE2eFixtures(
  db: Database,
  env: SeedTargetEnv,
  storesOn: StockLocationE2eStoresOn,
  now: Date = new Date(),
): Promise<StockLocationE2eSeedResult> {
  const target = await assertSeedTarget(db, STOCK_LOCATION_E2E_SEED, env);
  if (!target.hermetic) {
    throw new Error(
      `[${STOCK_LOCATION_E2E_SEED}] refusing to seed: the database is marked "${target.environment}", not a hermetic local one`,
    );
  }
  // One transaction: the stores' own transactions become savepoints, so a failed run leaves
  // nothing half written.
  return db.transaction(async (tx) => {
    const { register, locations: store } = storesOn(tx as unknown as Database);
    const created: string[] = [];
    // A week back, so the fixtures sit below the artworks the other checks open from the list.
    const at = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const registerIds = {} as Record<StockLocationE2eArtwork, string>;
    const keys = Object.keys(STOCK_LOCATION_E2E_ARTWORKS) as StockLocationE2eArtwork[];
    for (const [index, key] of keys.entries()) {
      const { zohoProductId } = STOCK_LOCATION_E2E_ARTWORKS[key];
      const existing = await register.findByZohoProductId(zohoProductId);
      if (existing) {
        registerIds[key] = existing.id;
        continue;
      }
      const result = await register.create(entryFor(key, index + 1), "zoho", at);
      if (!result.ok) {
        throw new Error(`[${STOCK_LOCATION_E2E_SEED}] ${zohoProductId}: ${result.reason}`);
      }
      registerIds[key] = result.entry.id;
      created.push(`artwork:${key}`);
    }

    const all = await store.listLocations({ includeRetired: true });
    let location = all.find(
      (place) => place.name.toLowerCase() === STOCK_LOCATION_E2E_LOCATION.toLowerCase(),
    );
    if (!location) {
      const added = await store.addLocation({
        name: STOCK_LOCATION_E2E_LOCATION,
        note: "Seeded for the LAX Admin browser checks",
        actor: ACTOR,
        now: at,
      });
      if (!added.ok) throw new Error(`[${STOCK_LOCATION_E2E_SEED}] location: ${added.reason}`);
      location = added.location;
      created.push("location");
    } else if (location.status === "retired") {
      // Someone retired it by hand: the spec moves artworks to it, so bring it back.
      const restored = await store.setLocationStatus({
        id: location.id,
        expectedVersion: location.version,
        status: "active",
        now,
      });
      if (!restored.ok)
        throw new Error(`[${STOCK_LOCATION_E2E_SEED}] location: ${restored.reason}`);
      location = restored.location;
      created.push("location:restored");
    }

    const alreadyThere = registerIds.alreadyThere;
    if ((await store.listMoves(alreadyThere, 1)).length === 0) {
      const moved = await store.moveArtworks({
        registerIds: [alreadyThere],
        locationId: location.id,
        note: "Unpacked from the delivery",
        actor: ACTOR,
        now: new Date(at.getTime() + 60 * 60 * 1000),
      });
      if (!moved.ok) throw new Error(`[${STOCK_LOCATION_E2E_SEED}] move: ${moved.reason}`);
      created.push("move:alreadyThere");
    }

    return { registerIds, locationId: location.id, created };
  });
}
