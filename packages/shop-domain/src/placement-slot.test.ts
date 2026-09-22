import { describe, expect, it } from "vitest";
import {
  assertValidPlacement,
  assertValidPlacementSet,
  isPlacementSlot,
  maxItemsForPlacement,
} from "./placement-slot.js";
import { ShopDomainError } from "./shop-domain-error.js";

describe("placement-slot", () => {
  it("recognises known slots", () => {
    expect(isPlacementSlot("featured_prints")).toBe(true);
    expect(isPlacementSlot("unknown")).toBe(false);
  });

  it("enforces target kind per slot", () => {
    expect(() => assertValidPlacement("featured_artists", { kind: "artwork", id: "a" })).toThrow(
      ShopDomainError,
    );
    expect(() =>
      assertValidPlacement("featured_artists", { kind: "artist", id: "a" }),
    ).not.toThrow();
  });

  it("exposes max item caps", () => {
    expect(maxItemsForPlacement("featured_prints")).toBe(12);
  });

  it("rejects invalid placement sets before persistence", () => {
    expect(() =>
      assertValidPlacementSet([
        {
          slot: "featured_artists",
          position: 0,
          target: { kind: "artwork", id: "artwork-1" },
        },
      ]),
    ).toThrow(/accepts artist targets/);

    expect(() =>
      assertValidPlacementSet([
        {
          slot: "featured_artists",
          position: 0,
          target: { kind: "artist", id: "artist-1" },
        },
        {
          slot: "featured_artists",
          position: 0,
          target: { kind: "artist", id: "artist-2" },
        },
      ]),
    ).toThrow(/duplicate position/);
  });
});
