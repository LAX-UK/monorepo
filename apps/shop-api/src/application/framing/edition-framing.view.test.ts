import { describe, expect, it } from "vitest";
import {
  BLACK,
  OAK,
  WALNUT,
  editionFacts,
  liveOption,
} from "../../test-support/in-memory-edition-framing.js";
import {
  FRAMING_CHOICE_MESSAGES,
  framingChoiceProblem,
  presentBasketFraming,
  presentPublicFraming,
  visibleOffers,
} from "./edition-framing.view.js";

const oak = liveOption(OAK, { name: "Natural oak frame" });
const black = liveOption(BLACK, { name: "Black wood frame" });
const waiting = liveOption(WALNUT, {
  name: "Walnut frame",
  status: "draft",
  placeholderBands: ["up_to_60x80"],
});

describe("what a buyer is shown", () => {
  it("lists only options that are offered with every price the framer's", () => {
    const facts = editionFacts({}, [{ option: oak }, { option: waiting }]);
    expect(visibleOffers(facts).map((offer) => offer.optionId)).toEqual([OAK]);
  });

  it("prices each option for the edition's size band, and uses the edition's own price when set", () => {
    const facts = editionFacts({}, [{ option: oak }, { option: black, overridePence: 21000 }]);
    expect(visibleOffers(facts).map((offer) => [offer.optionId, offer.pricePence])).toEqual([
      [OAK, 19500],
      [BLACK, 21000],
    ]);
  });

  it("shows nothing when the sheet size has no band, since it cannot be priced", () => {
    const facts = editionFacts({ sheetSize: "90 × 120 cm" }, [{ option: oak }]);
    expect(visibleOffers(facts)).toEqual([]);
    expect(presentPublicFraming(facts).kind).toBe("none");
    expect(presentPublicFraming(editionFacts({ sheetSize: null }, [{ option: oak }])).kind).toBe(
      "none",
    );
  });

  it("looks as it did before when an edition offers no framing", () => {
    expect(presentPublicFraming(editionFacts())).toEqual({
      kind: "none",
      required: false,
      description: null,
      options: [],
    });
  });

  it("lets the buyer choose, unframed included, when options are offered", () => {
    const view = presentPublicFraming(editionFacts({}, [{ option: oak }]));
    expect(view).toMatchObject({ kind: "choose", required: false });
    expect(view.options).toEqual([
      expect.objectContaining({ id: OAK, name: "Natural oak frame", pricePence: 19500 }),
    ]);
  });

  it("requires a choice when sold framed only", () => {
    const view = presentPublicFraming(editionFacts({ mode: "framed_only" }, [{ option: oak }]));
    expect(view).toMatchObject({ kind: "choose", required: true });
  });

  it("cannot be bought framed-only when no option is visible any more", () => {
    const view = presentPublicFraming(editionFacts({ mode: "framed_only" }, [{ option: waiting }]));
    expect(view).toMatchObject({ kind: "unavailable", options: [] });
  });

  it("describes a print that comes framed by the artist and offers no options", () => {
    const view = presentPublicFraming(
      editionFacts({ mode: "framed_by_artist", framedByArtist: "Oak, by the artist" }, [
        { option: oak },
      ]),
    );
    expect(view).toEqual({
      kind: "framed_by_artist",
      required: false,
      description: "Oak, by the artist",
      options: [],
    });
  });

  it("never carries a price that is not the framer's", () => {
    const view = presentPublicFraming(editionFacts({}, [{ option: waiting }]));
    expect(JSON.stringify(view)).not.toContain("Walnut");
  });
});

describe("the framing on a basket line", () => {
  it("describes the option with its price for this edition", () => {
    const facts = editionFacts({}, [{ option: oak, overridePence: 21000 }]);
    expect(presentBasketFraming(facts, oak)).toMatchObject({
      optionId: OAK,
      name: "Natural oak frame",
      pricePence: 21000,
      leadTimeMinDays: 10,
      leadTimeMaxDays: 15,
      available: true,
    });
  });

  it("still describes an option that was paused since, marked unavailable", () => {
    const paused = { ...oak, status: "paused" as const };
    const facts = editionFacts({}, [{ option: paused }]);
    expect(presentBasketFraming(facts, paused)).toMatchObject({
      name: "Natural oak frame",
      available: false,
    });
  });

  it("marks an option the edition no longer offers unavailable, at the catalogue price", () => {
    const facts = editionFacts();
    expect(presentBasketFraming(facts, oak)).toMatchObject({ pricePence: 19500, available: false });
  });
});

describe("framingChoiceProblem", () => {
  const facts = editionFacts({}, [{ option: oak }, { option: waiting }]);

  it("accepts unframed, and an option the buyer is shown", () => {
    expect(framingChoiceProblem(facts, null)).toBeNull();
    expect(framingChoiceProblem(facts, OAK)).toBeNull();
  });

  it("refuses an option that is offered but not shown right now", () => {
    expect(framingChoiceProblem(facts, WALNUT)).toBe("framing_not_available");
  });

  it("refuses an option the edition does not offer", () => {
    expect(framingChoiceProblem(facts, BLACK)).toBe("framing_not_offered");
  });

  it("asks for a frame on an edition sold framed only", () => {
    const framedOnly = editionFacts({ mode: "framed_only" }, [{ option: oak }]);
    expect(framingChoiceProblem(framedOnly, null)).toBe("choose_framing");
    expect(framingChoiceProblem(framedOnly, OAK)).toBeNull();
  });

  it("takes no choice on a print that comes framed by the artist", () => {
    const byArtist = editionFacts({ mode: "framed_by_artist", framedByArtist: "Oak" }, [
      { option: oak },
    ]);
    expect(framingChoiceProblem(byArtist, OAK)).toBe("framing_not_offered");
    expect(framingChoiceProblem(byArtist, null)).toBeNull();
  });

  it("has a plain sentence for each problem", () => {
    expect(FRAMING_CHOICE_MESSAGES.choose_framing).toBe("Choose a frame for this edition.");
  });
});
