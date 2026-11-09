import type { BasketLineFraming } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  BLACK,
  OAK,
  editionFacts,
  liveOption,
} from "../../test-support/in-memory-edition-framing.js";
import {
  assertFramingOrderable,
  framingOrderProblem,
  framingPriceDrift,
  framingSubtotalPence,
} from "./framing-order-guard.js";

const ARTWORK = "00000000-0000-4000-8000-0000000000b1";

const framing = (overrides: Partial<BasketLineFraming> = {}): BasketLineFraming => ({
  optionId: OAK,
  name: "Natural oak frame",
  frame: "natural_oak",
  mount: "window_conservation",
  glazing: "uv_acrylic",
  hanging: "d_rings_cord",
  pricePence: 21000,
  leadTimeMinDays: 10,
  leadTimeMaxDays: 15,
  available: true,
  ...overrides,
});

const framed = (quantity = 1, f: Partial<BasketLineFraming> = {}) => ({
  artworkId: ARTWORK,
  quantity,
  framingOptionId: OAK,
  framing: framing(f),
});
const plain = { artworkId: ARTWORK, quantity: 1, framingOptionId: null, framing: null };

const oak = liveOption(OAK, { name: "Natural oak frame" });
const facts = (
  mode: "unframed_or_framed" | "framed_only" | "framed_by_artist" = "unframed_or_framed",
) =>
  new Map([
    [
      ARTWORK,
      editionFacts({ mode, framedByArtist: mode === "framed_by_artist" ? "Oak" : "" }, [
        { option: oak },
      ]),
    ],
  ]);

describe("framingOrderProblem", () => {
  it("lets lines without framing through, with framing on or off", () => {
    for (const framingEnabled of [true, false]) {
      expect(
        framingOrderProblem({ lines: [plain], framingEnabled, factsByArtwork: facts() }),
      ).toBeNull();
    }
  });

  it("lets a frame that is on offer through while framing is on", () => {
    expect(
      framingOrderProblem({ lines: [framed(2)], framingEnabled: true, factsByArtwork: facts() }),
    ).toBeNull();
  });

  it("refuses any frame while framing is off", () => {
    expect(
      framingOrderProblem({ lines: [framed()], framingEnabled: false, factsByArtwork: new Map() }),
    ).toMatchObject({ status: 409, code: "shop.basket_conflict" });
  });

  it("refuses a frame that is no longer on offer, however the basket looked before", () => {
    expect(
      framingOrderProblem({
        lines: [framed(1, { available: false })],
        framingEnabled: true,
        factsByArtwork: facts(),
      }),
    ).toMatchObject({
      status: 409,
      message: expect.stringContaining("no longer offered"),
    });
  });

  it("refuses a framed-only edition with no frame, and a print framed by the artist with one", () => {
    expect(
      framingOrderProblem({
        lines: [plain],
        framingEnabled: true,
        factsByArtwork: facts("framed_only"),
      }),
    ).toMatchObject({ status: 400, message: "Choose a frame for this edition." });
    expect(
      framingOrderProblem({
        lines: [framed()],
        framingEnabled: true,
        factsByArtwork: facts("framed_by_artist"),
      }),
    ).toMatchObject({ status: 400 });
  });

  it("refuses an option the edition does not offer", () => {
    const line = { ...framed(), framingOptionId: BLACK, framing: framing({ optionId: BLACK }) };
    expect(
      framingOrderProblem({ lines: [line], framingEnabled: true, factsByArtwork: facts() }),
    ).toMatchObject({ status: 400, message: "That framing is not offered for this edition." });
  });

  it("throws the problem as an API error", () => {
    expect(() =>
      assertFramingOrderable({
        lines: [framed()],
        framingEnabled: false,
        factsByArtwork: new Map(),
      }),
    ).toThrowError("Framing is no longer available");
  });
});

describe("framingSubtotalPence", () => {
  it("is the frame's price for each print on each line, and nothing for an unframed line", () => {
    expect(framingSubtotalPence([framed(2), plain, framed(1, { pricePence: 19500 })])).toBe(
      2 * 21000 + 19500,
    );
    expect(framingSubtotalPence([plain])).toBe(0);
  });
});

describe("framingPriceDrift", () => {
  const line = (framingPricePence: number | null, live = 21000, available = true) => ({
    lineId: "line-1",
    framingOptionId: OAK,
    framingPricePence,
    framing: framing({ pricePence: live, available }),
  });

  it("reports a stamped frame whose price has moved, and brings it to today's price", () => {
    expect(framingPriceDrift([line(19500)])).toEqual({
      stamps: [{ lineId: "line-1", pricePence: 21000 }],
      moved: true,
    });
  });

  it("stamps a frame with no stamp yet without calling it a change", () => {
    expect(framingPriceDrift([line(null)])).toEqual({
      stamps: [{ lineId: "line-1", pricePence: 21000 }],
      moved: false,
    });
  });

  it("leaves an unchanged price, a line with no frame and a frame no longer on offer alone", () => {
    expect(framingPriceDrift([line(21000)])).toEqual({ stamps: [], moved: false });
    expect(
      framingPriceDrift([
        { lineId: "p", framingOptionId: null, framing: null, framingPricePence: null },
      ]),
    ).toEqual({ stamps: [], moved: false });
    expect(framingPriceDrift([line(19500, 21000, false)])).toEqual({ stamps: [], moved: false });
  });
});
