import type { AdminArtworkLocation, AdminStockLocation } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  NAME_TAKEN,
  checkLocationForm,
  checkMoveForm,
  locationFilterOptions,
  locationHistory,
  moveOptions,
  moveOutcomeMessage,
} from "./stock-location.vm";

const ROOM = "11111111-1111-4111-8111-111111111111";
const FRAMER = "22222222-2222-4222-8222-222222222222";

function location(id: string, name: string, status: "active" | "retired"): AdminStockLocation {
  return {
    id,
    name,
    note: null,
    status,
    version: 1,
    createdAt: "2026-11-01T09:00:00.000Z",
    updatedAt: "2026-11-01T09:00:00.000Z",
    retiredAt: null,
  };
}

const LIST = [location(ROOM, "Store room", "active"), location(FRAMER, "Framer", "retired")];

describe("the location form", () => {
  it("takes a trimmed name and a blank note as none", () => {
    expect(checkLocationForm({ name: "  Gallery, main room ", note: "  " }, LIST)).toEqual({
      ok: true,
      body: { name: "Gallery, main room", note: null },
    });
  });

  it("says what is wrong with each field at once", () => {
    expect(checkLocationForm({ name: " ", note: "x".repeat(201) }, LIST)).toEqual({
      ok: false,
      errors: {
        name: "Give the location a name.",
        note: "Keep the note to 200 characters or fewer.",
      },
    });
    // Counted as characters, as Postgres counts them: 80 emoji fit, 81 do not.
    expect(checkLocationForm({ name: "🖼".repeat(80), note: "" }, LIST).ok).toBe(true);
    expect(checkLocationForm({ name: "🖼".repeat(81), note: "" }, LIST)).toMatchObject({
      errors: { name: "Keep the name to 80 characters or fewer." },
    });
  });

  it("refuses a name another location has, ignoring case, retired ones included", () => {
    expect(checkLocationForm({ name: "store ROOM", note: "" }, LIST)).toEqual({
      ok: false,
      errors: { name: NAME_TAKEN },
    });
    expect(checkLocationForm({ name: "framer", note: "" }, LIST)).toMatchObject({ ok: false });
    // A location keeps its own name, in another case too.
    expect(checkLocationForm({ name: "Store Room", note: "" }, LIST, ROOM).ok).toBe(true);
  });
});

describe("the move form", () => {
  const active = [{ id: ROOM }];

  it("needs an active location and keeps a note to 500 characters", () => {
    expect(checkMoveForm({ locationId: null, note: "x".repeat(501) }, active)).toEqual({
      ok: false,
      errors: {
        locationId: "Choose where the artwork is going.",
        note: "Keep the note to 500 characters or fewer.",
      },
    });
    // A place no longer offered (retired since the dialog opened) is not taken.
    expect(checkMoveForm({ locationId: FRAMER, note: "" }, active)).toMatchObject({ ok: false });
    expect(checkMoveForm({ locationId: ROOM, note: " Winter hang " }, active)).toEqual({
      ok: true,
      body: { locationId: ROOM, note: "Winter hang" },
    });
  });

  it("offers active places only, marking where the artwork is now", () => {
    expect(moveOptions(LIST, ROOM)).toEqual([
      { value: ROOM, label: "Store room", description: "Where it is now" },
    ]);
  });

  it("says what a move did, for one artwork or a selection", () => {
    const id = (n: number) => `id-${n}`;
    const moved = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        registerId: id(i),
        fromLocationId: null,
      }));
    const none = { moved: [], unchanged: [], notFound: [] };
    expect(moveOutcomeMessage({ ...none, moved: moved(1) }, "Framer")).toBe("Moved to Framer");
    expect(moveOutcomeMessage({ ...none, unchanged: [id(1)] }, "Framer")).toBe("Already at Framer");
    expect(moveOutcomeMessage({ ...none, moved: moved(3) }, "Store room")).toBe(
      "3 artworks moved to Store room",
    );
    expect(
      moveOutcomeMessage({ moved: moved(2), unchanged: [id(8)], notFound: [id(9)] }, "Store room"),
    ).toBe(
      "2 artworks moved to Store room; 1 artwork already there; 1 artwork no longer on the register",
    );
  });
});

describe("the All list's Location filter", () => {
  it("lists Location not recorded first, then every place, retired ones marked", () => {
    expect(locationFilterOptions(LIST)).toEqual([
      { value: "none", label: "Location not recorded" },
      { value: ROOM, label: "Store room" },
      { value: FRAMER, label: "Framer (retired)" },
    ]);
  });
});

describe("the Location panel's history", () => {
  it("reads each move from → to, the first as recorded, with who and the note", () => {
    const ref = (id: string, name: string, status: "active" | "retired" = "active") => ({
      id,
      name,
      status,
      label: status === "retired" ? `${name} (retired)` : name,
    });
    const panel: AdminArtworkLocation = {
      registerId: "r",
      label: "Store room",
      current: null,
      moves: [
        {
          id: "m2",
          from: ref(FRAMER, "Framer", "retired"),
          to: ref(ROOM, "Store room"),
          movedAt: "2026-11-17T10:00:00.000Z",
          movedBy: "staff:ops-1",
          movedByName: "Ana Ruiz",
          note: "Back from framing",
        },
        {
          id: "m1",
          from: null,
          to: ref(FRAMER, "Framer", "retired"),
          movedAt: "2026-11-10T10:00:00.000Z",
          movedBy: "staff:gone",
          movedByName: null,
          note: null,
        },
      ],
      moreMoves: false,
    };
    expect(locationHistory(panel)).toEqual([
      {
        id: "m2",
        at: "2026-11-17T10:00:00.000Z",
        actor: "Ana Ruiz",
        title: "Framer (retired) → Store room",
        detail: "Back from framing",
      },
      {
        id: "m1",
        at: "2026-11-10T10:00:00.000Z",
        actor: "LAX staff",
        title: "First recorded at Framer (retired)",
      },
    ]);
  });
});
