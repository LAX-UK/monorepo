import type {
  CurrentLocation,
  LocationMove,
  LocationMoveRefusal,
  LocationStatus,
  StockLocation,
} from "@auction/artwork-register-contracts";

/**
 * Stock location reads: the list staff keep, where each artwork is now and where it has been.
 * Design: docs/design/stock-location.md.
 */
export interface IStockLocationReader {
  /** Active locations by name; retired ones after them when asked for. */
  listLocations(options?: { includeRetired?: boolean }): Promise<StockLocation[]>;
  findLocation(id: string): Promise<StockLocation | null>;
  /** The artwork's latest move, or null when none is recorded. */
  currentLocation(registerId: string): Promise<CurrentLocation | null>;
  /** The current location of each artwork that has one; artworks without one are left out. */
  currentLocations(registerIds: readonly string[]): Promise<Map<string, CurrentLocation>>;
  /** The artwork's moves, newest first, each with where it came from. */
  listMoves(registerId: string, limit: number): Promise<LocationMove[]>;
}

export type LocationWriteResult =
  | { ok: true; location: StockLocation }
  | { ok: false; reason: "not_found" | "stale" | "name_taken" };

/** Inputs are already checked with the rules in `stock-location.ts`; the database repeats them. */
export type AddLocationInput = {
  name: string;
  note: string | null;
  /** `staff:<user id>`. */
  actor: string;
  now: Date;
};

export type UpdateLocationInput = {
  id: string;
  expectedVersion: number;
  name: string;
  note: string | null;
  now: Date;
};

export type SetLocationStatusInput = {
  id: string;
  expectedVersion: number;
  status: LocationStatus;
  now: Date;
};

export type MoveArtworksInput = {
  /** One artwork, or a selection for "Move selected". Repeats are moved once. */
  registerIds: readonly string[];
  locationId: string;
  note: string | null;
  /** `staff:<user id>`. */
  actor: string;
  now: Date;
};

export type MoveArtworksResult =
  | {
      ok: true;
      /** Each artwork moved, with the location it left (null when none was recorded). */
      moved: { registerId: string; fromLocationId: string | null }[];
      /** Already at the location: nothing recorded. */
      unchanged: string[];
      /** Not on the register. */
      notFound: string[];
    }
  | { ok: false; reason: LocationMoveRefusal };

/**
 * Stock location writes. Locations are retired, never deleted. A move records the move, the
 * record's history entry and `artwork_register.location_changed` in one transaction, so none
 * exists without the others.
 */
export interface IStockLocationWriter {
  /** False with `name_taken` when another location already has the name, ignoring case. */
  addLocation(input: AddLocationInput): Promise<LocationWriteResult>;
  /** Renames a location or changes its note. Moves keep pointing at it, so history reads the new name. */
  updateLocation(input: UpdateLocationInput): Promise<LocationWriteResult>;
  /** Retires a location (it takes no new moves) or brings it back. */
  setLocationStatus(input: SetLocationStatusInput): Promise<LocationWriteResult>;
  moveArtworks(input: MoveArtworksInput): Promise<MoveArtworksResult>;
}

export interface IStockLocationStore extends IStockLocationReader, IStockLocationWriter {}
