import {
  type CurrentLocation,
  LOCATION_NAME_MAX,
  LOCATION_NOTE_MAX,
  type LocationMove,
  type LocationRef,
  type LocationStatus,
  MOVE_BATCH_MAX,
  MOVE_NOTE_MAX,
  type MoveArtworksRequest,
  type StockLocation,
  type TextRefusal,
  currentLocationLabel,
  locationLabel,
  parseLocationName,
  parseLocationNote,
  parseMoveNote,
} from "@auction/artwork-register-contracts";
import {
  type AdminArtworkLocation,
  type AdminArtworkLocationMoveResult,
  type AdminStockLocation,
  type AdminStockLocationWriteResult,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import type { ShopStaffCapability } from "@auction/shop-domain";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../ports/shop-unit-of-work.js";
import type {
  StockLocationReads,
  StockLocationWriteResult,
  StockLocationWritesFor,
} from "../ports/stock-location.ports.js";

/** How many moves the Location panel shows; older ones are flagged with `moreMoves`. */
export const LOCATION_HISTORY_LIMIT = 100;

const MANAGE: ShopStaffCapability = "artwork_location.manage";
const MOVE: ShopStaffCapability = "artwork_location.move";

type Actor = { actorSubjectId: string; idempotencyKey: string };

export type StockLocationServiceDeps = {
  uow: ShopUnitOfWorkFactory;
  reads: StockLocationReads;
  writesFor: StockLocationWritesFor;
  clock?: () => Date;
};

const iso = (date: Date) => date.toISOString();

function presentLocation(location: StockLocation): AdminStockLocation {
  return {
    id: location.id,
    name: location.name,
    note: location.note,
    status: location.status,
    version: location.version,
    createdAt: iso(location.createdAt),
    updatedAt: iso(location.updatedAt),
    retiredAt: location.retiredAt ? iso(location.retiredAt) : null,
  };
}

const presentRef = (ref: LocationRef) => ({
  id: ref.id,
  name: ref.name,
  status: ref.status,
  label: locationLabel(ref),
});

function presentArtworkLocation(
  registerId: string,
  current: CurrentLocation | null,
  moves: LocationMove[],
): AdminArtworkLocation {
  const shown = moves.slice(0, LOCATION_HISTORY_LIMIT);
  return {
    registerId,
    label: currentLocationLabel(current),
    current: current
      ? {
          location: presentRef(current.location),
          movedAt: iso(current.movedAt),
          movedBy: current.movedBy,
        }
      : null,
    moves: shown.map((move) => ({
      id: move.id,
      from: move.from ? presentRef(move.from) : null,
      to: presentRef(move.to),
      movedAt: iso(move.movedAt),
      movedBy: move.movedBy,
      note: move.note,
    })),
    moreMoves: moves.length > LOCATION_HISTORY_LIMIT,
  };
}

const validation = (message: string) =>
  new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, message, 400);
const conflict = (message: string) => new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, message, 409);
const notFound = (message: string) =>
  new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, message, 404);

function textOrRefuse<T>(
  parsed: { ok: true; value: T } | { ok: false; reason: TextRefusal },
  messages: Record<TextRefusal, string>,
): T {
  if (!parsed.ok) throw validation(messages[parsed.reason]);
  return parsed.value;
}

const parseName = (raw: string) =>
  textOrRefuse(parseLocationName(raw), {
    empty: "Give the location a name.",
    too_long: `Keep the name to ${LOCATION_NAME_MAX} characters or fewer.`,
  });

const parseNote = (raw: string | null | undefined) =>
  textOrRefuse(parseLocationNote(raw), {
    empty: "",
    too_long: `Keep the note to ${LOCATION_NOTE_MAX} characters or fewer.`,
  });

/** A list write that did not happen, in the words the Locations page shows. */
function refuseListWrite(result: Exclude<StockLocationWriteResult, { ok: true }>): never {
  switch (result.reason) {
    case "not_found":
      throw notFound("Location not found");
    case "stale":
      throw conflict("Someone else changed this location. Reload it and try again.");
    case "name_taken":
      throw conflict("Another location already has this name.");
  }
}

const auditView = (location: StockLocation) => ({
  name: location.name,
  note: location.note,
  status: location.status,
  version: location.version,
});

/**
 * Stock location in LAX Admin. Every write runs in one unit of work with its idempotency record
 * and its audit row, and the store's own transaction nests inside it, so a list change or a move
 * never commits without its audit row, and an audit row never outlives a rolled-back change.
 */
export function createStockLocationService(deps: StockLocationServiceDeps) {
  const now = deps.clock ?? (() => new Date());

  async function writeStatus(
    command: Actor & { locationId: string; expectedVersion: number; status: LocationStatus },
  ): Promise<AdminStockLocationWriteResult> {
    const action =
      command.status === "retired" ? "artwork_location.retire" : "artwork_location.restore";
    return deps.uow.run((tx) =>
      withAdminIdempotency({
        tx,
        commandType: action,
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: {
          locationId: command.locationId,
          expectedVersion: command.expectedVersion,
        },
        run: async () => {
          const store = deps.writesFor(tx);
          const before = await store.findLocation(command.locationId);
          const result = await store.setLocationStatus({
            id: command.locationId,
            expectedVersion: command.expectedVersion,
            status: command.status,
            now: now(),
          });
          if (!result.ok) refuseListWrite(result);
          // Already so: nothing was written, so there is nothing to audit.
          if (result.changed) {
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: MANAGE,
              action,
              targetType: "artwork_location",
              targetId: result.location.id,
              ...(before ? { beforeJson: auditView(before) } : {}),
              afterJson: auditView(result.location),
            });
          }
          return { changed: result.changed, location: presentLocation(result.location) };
        },
      }),
    );
  }

  return {
    async listLocations(options: { includeRetired?: boolean }) {
      const items = await deps.reads.listLocations({
        includeRetired: options.includeRetired === true,
      });
      return { items: items.map(presentLocation) };
    },

    /** Where the artwork is now and where it has been; null when it is not on the register. */
    async artworkLocation(registerId: string): Promise<AdminArtworkLocation | null> {
      if (!(await deps.reads.registerExists(registerId))) return null;
      const [current, moves] = await Promise.all([
        deps.reads.currentLocation(registerId),
        deps.reads.listMoves(registerId, LOCATION_HISTORY_LIMIT + 1),
      ]);
      return presentArtworkLocation(registerId, current, moves);
    },

    async addLocation(
      command: Actor & { name: string; note?: string | null | undefined },
    ): Promise<AdminStockLocationWriteResult> {
      const name = parseName(command.name);
      const note = parseNote(command.note);
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "artwork_location.add",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: { name, note },
          run: async () => {
            const result = await deps.writesFor(tx).addLocation({
              name,
              note,
              actor: `staff:${command.actorSubjectId}`,
              now: now(),
            });
            if (!result.ok) refuseListWrite(result);
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: MANAGE,
              action: "artwork_location.add",
              targetType: "artwork_location",
              targetId: result.location.id,
              afterJson: auditView(result.location),
            });
            return { changed: true, location: presentLocation(result.location) };
          },
        }),
      );
    },

    async updateLocation(
      command: Actor & {
        locationId: string;
        expectedVersion: number;
        name: string;
        note?: string | null | undefined;
      },
    ): Promise<AdminStockLocationWriteResult> {
      const name = parseName(command.name);
      const note = parseNote(command.note);
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "artwork_location.update",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: {
            locationId: command.locationId,
            expectedVersion: command.expectedVersion,
            name,
            note,
          },
          run: async () => {
            const store = deps.writesFor(tx);
            const before = await store.findLocation(command.locationId);
            const result = await store.updateLocation({
              id: command.locationId,
              expectedVersion: command.expectedVersion,
              name,
              note,
              now: now(),
            });
            if (!result.ok) refuseListWrite(result);
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: MANAGE,
              action: "artwork_location.update",
              targetType: "artwork_location",
              targetId: result.location.id,
              ...(before ? { beforeJson: auditView(before) } : {}),
              afterJson: auditView(result.location),
            });
            return { changed: true, location: presentLocation(result.location) };
          },
        }),
      );
    },

    retireLocation(command: Actor & { locationId: string; expectedVersion: number }) {
      return writeStatus({ ...command, status: "retired" });
    },

    restoreLocation(command: Actor & { locationId: string; expectedVersion: number }) {
      return writeStatus({ ...command, status: "active" });
    },

    /**
     * "Move" on a record or "Move selected". The body has already been parsed with
     * `moveArtworksRequestSchema`, so the batch limit holds before any lock is taken. One audit
     * row per artwork that moved; an artwork already there records nothing and is not audited.
     */
    async moveArtworks(
      command: Actor & { request: MoveArtworksRequest },
    ): Promise<AdminArtworkLocationMoveResult> {
      const note = textOrRefuse(parseMoveNote(command.request.note), {
        empty: "",
        too_long: `Keep the note to ${MOVE_NOTE_MAX} characters or fewer.`,
      });
      const { registerIds, locationId } = command.request;
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "artwork_location.move",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: { registerIds: [...new Set(registerIds)].sort(), locationId, note },
          run: async () => {
            const result = await deps.writesFor(tx).moveArtworks({
              registerIds,
              locationId,
              note,
              actor: `staff:${command.actorSubjectId}`,
              now: now(),
            });
            if (!result.ok) {
              switch (result.reason) {
                case "location_not_found":
                  throw notFound("Location not found");
                case "location_retired":
                  throw conflict("This location has been retired. Choose another.");
                case "too_many":
                  throw validation(`Move at most ${MOVE_BATCH_MAX} artworks at a time.`);
              }
            }
            for (const moved of result.moved) {
              await tx.audit.append({
                actorSubjectId: command.actorSubjectId,
                capability: MOVE,
                action: "artwork_location.move",
                targetType: "artwork_register",
                targetId: moved.registerId,
                beforeJson: { locationId: moved.fromLocationId },
                afterJson: { locationId, withNote: note !== null },
              });
            }
            return {
              locationId,
              moved: result.moved,
              unchanged: result.unchanged,
              notFound: result.notFound,
            };
          },
        }),
      );
    },
  };
}

export type StockLocationService = ReturnType<typeof createStockLocationService>;
