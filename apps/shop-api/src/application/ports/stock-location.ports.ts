import type {
  CurrentLocation,
  LocationMove,
  LocationMoveRefusal,
  LocationStatus,
  StockLocation,
} from "@auction/artwork-register-contracts";
import type { ShopTransactionEffects } from "./shop-unit-of-work.js";

/** What LAX Admin reads about stock locations, outside any write. */
export type StockLocationReads = {
  listLocations(options?: { includeRetired?: boolean }): Promise<StockLocation[]>;
  /** Whether the artwork is on the register, so an unknown id reads as not found. */
  registerExists(registerId: string): Promise<boolean>;
  currentLocation(registerId: string): Promise<CurrentLocation | null>;
  /** Newest first. */
  listMoves(registerId: string, limit: number): Promise<LocationMove[]>;
};

export type StockLocationWriteResult =
  | { ok: true; changed: boolean; location: StockLocation }
  | { ok: false; reason: "not_found" | "stale" | "name_taken" };

export type StockLocationMoveResult =
  | {
      ok: true;
      moved: { registerId: string; fromLocationId: string | null }[];
      unchanged: string[];
      notFound: string[];
    }
  | { ok: false; reason: LocationMoveRefusal };

/**
 * The location store bound to one unit of work, so the list change or the move, its register
 * history, its domain events, the LAX Admin audit row and the idempotency record commit together
 * or not at all.
 */
export type StockLocationWrites = {
  findLocation(id: string): Promise<StockLocation | null>;
  addLocation(input: {
    name: string;
    note: string | null;
    actor: string;
    now: Date;
  }): Promise<StockLocationWriteResult>;
  updateLocation(input: {
    id: string;
    expectedVersion: number;
    name: string;
    note: string | null;
    now: Date;
  }): Promise<StockLocationWriteResult>;
  setLocationStatus(input: {
    id: string;
    expectedVersion: number;
    status: LocationStatus;
    now: Date;
  }): Promise<StockLocationWriteResult>;
  moveArtworks(input: {
    registerIds: readonly string[];
    locationId: string;
    note: string | null;
    actor: string;
    now: Date;
  }): Promise<StockLocationMoveResult>;
};

export type StockLocationWritesFor = (tx: ShopTransactionEffects) => StockLocationWrites;
