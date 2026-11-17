import type { LocationMove } from "@auction/artwork-register-contracts";
import { describe, expect, it, vi } from "vitest";
import type { ShopUnitOfWorkFactory } from "../ports/shop-unit-of-work.js";
import type { StockLocationReads } from "../ports/stock-location.ports.js";
import { LOCATION_HISTORY_LIMIT, createStockLocationService } from "./stock-location.service.js";

const REGISTER_ID = "11111111-1111-4111-8111-111111111111";
const ROOM = { id: "22222222-2222-4222-8222-222222222222", name: "Store room", status: "active" };
const FRAMER = { id: "33333333-3333-4333-8333-333333333333", name: "Framer", status: "retired" };
const T0 = Date.parse("2026-11-17T09:00:00.000Z");

/** `count` moves, newest first, alternating between the two places; the oldest has no "from". */
function movesOf(count: number): LocationMove[] {
  return Array.from({ length: count }, (_, index) => {
    const age = count - 1 - index;
    const to = index % 2 === 0 ? ROOM : FRAMER;
    const from = index % 2 === 0 ? FRAMER : ROOM;
    return {
      id: `move-${index}`,
      registerId: REGISTER_ID,
      from: age === 0 ? null : (from as LocationMove["to"]),
      to: to as LocationMove["to"],
      movedAt: new Date(T0 + age * 60_000),
      movedBy: index === 0 ? "staff:ops-1" : "zoho",
      note: null,
    };
  });
}

/** A service reading `moves` for the artwork; null reads as an artwork not on the register. */
function serviceReading(moves: LocationMove[] | null) {
  const artworkMoves = vi.fn(async (_registerId: string, limit: number) =>
    moves ? moves.slice(0, limit) : null,
  );
  const namesFor = vi.fn(
    async (subjects: readonly string[]) =>
      new Map(subjects.map((subject) => [subject, "Ana Ruiz"])),
  );
  const reads: StockLocationReads = {
    listLocations: async () => [],
    artworkMoves,
  };
  const service = createStockLocationService({
    uow: { run: () => Promise.reject(new Error("no writes here")) } as ShopUnitOfWorkFactory,
    reads,
    writesFor: () => {
      throw new Error("no writes here");
    },
    staffNames: { namesFor },
  });
  return { service, artworkMoves, namesFor };
}

describe("an artwork's location and history", () => {
  it(`shows ${LOCATION_HISTORY_LIMIT} moves and says there are no more when there are exactly that many`, async () => {
    const { service, artworkMoves } = serviceReading(movesOf(LOCATION_HISTORY_LIMIT));
    const read = await service.artworkLocation(REGISTER_ID);
    expect(artworkMoves).toHaveBeenCalledWith(REGISTER_ID, LOCATION_HISTORY_LIMIT + 1);
    expect(read?.moves).toHaveLength(LOCATION_HISTORY_LIMIT);
    expect(read?.moreMoves).toBe(false);
  });

  it(`shows the newest ${LOCATION_HISTORY_LIMIT} and flags older moves when there is one more`, async () => {
    const all = movesOf(LOCATION_HISTORY_LIMIT + 1);
    const { service } = serviceReading(all);
    const read = await service.artworkLocation(REGISTER_ID);
    expect(read?.moves).toHaveLength(LOCATION_HISTORY_LIMIT);
    expect(read?.moves[0]?.id).toBe("move-0");
    expect(read?.moves.at(-1)?.id).toBe(`move-${LOCATION_HISTORY_LIMIT - 1}`);
    expect(read?.moreMoves).toBe(true);
  });

  it("takes the current location from the newest move, naming the staff member", async () => {
    const { service, namesFor } = serviceReading(movesOf(3));
    const read = await service.artworkLocation(REGISTER_ID);
    expect(read?.label).toBe("Store room");
    expect(read?.current).toEqual({
      location: { ...ROOM, label: "Store room" },
      movedAt: new Date(T0 + 2 * 60_000).toISOString(),
      movedBy: "staff:ops-1",
      movedByName: "Ana Ruiz",
    });
    // Only staff are looked up; a move by anyone else has no name.
    expect(namesFor).toHaveBeenCalledWith(["ops-1"]);
    expect(read?.moves.map((move) => move.movedByName)).toEqual(["Ana Ruiz", null, null]);
    expect(read?.moves[1]?.to.label).toBe("Framer (retired)");
  });

  it("reads Location not recorded with no current location and no history", async () => {
    const { service } = serviceReading([]);
    const read = await service.artworkLocation(REGISTER_ID);
    expect(read).toMatchObject({
      label: "Location not recorded",
      current: null,
      moves: [],
      moreMoves: false,
    });
  });

  it("reads null for an artwork not on the register, without looking up names", async () => {
    const { service, namesFor } = serviceReading(null);
    expect(await service.artworkLocation(REGISTER_ID)).toBeNull();
    expect(namesFor).not.toHaveBeenCalled();
  });
});
