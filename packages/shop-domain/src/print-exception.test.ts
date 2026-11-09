import { describe, expect, it } from "vitest";
import { type EditionFacts, describeEditionFacts } from "./edition-facts.js";
import { type EditionRunSpec, LAX_STANDARD_RUN } from "./edition-run.js";
import {
  createEditionSnapshot,
  describeSnapshotPrint,
  readEditionSnapshot,
} from "./edition-snapshot.js";
import {
  type PrintException,
  type PrintState,
  assertPrintException,
  assertRunHasNumberedPrints,
  describePrintException,
  describeReturnBlock,
  describeSetApartAvailable,
  describeSetApartBlock,
  exceptionKinds,
  returnBlock,
  setApartBlock,
  setApartListingSlug,
  setApartListingTitle,
  setApartPrintFor,
  setApartPrintOf,
  setApartPrintText,
} from "./print-exception.js";
import { describePublicEdition } from "./public-edition.js";
import type { Signature } from "./signature.js";

const NOW = new Date("2026-11-09T12:00:00Z");
const PENCIL: Signature = { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" };
const INK: Signature = { kind: "hand_signed", medium: "ink", place: "back" };
const REMARQUE: PrintException = { remarque: { medium: "pencil", place: "lower_margin" } };

const facts: EditionFacts = {
  numbering: "on_print",
  signature: PENCIL,
  certificate: {
    kind: "included",
    issuer: "artist",
    form: "paper",
    arrives: { kind: "with_print" },
    numberedToMatch: true,
  },
  confirmed: { by: "staff-1", at: new Date("2026-10-01T00:00:00Z") },
};

const state = (overrides: Partial<PrintState> = {}): PrintState => ({
  listingStatus: "authorised",
  reservedUntil: null,
  reservedByPendingOrder: false,
  forSale: true,
  alreadySetApart: false,
  ...overrides,
});

describe("assertPrintException", () => {
  it("needs at least one difference", () => {
    expect(() => assertPrintException({}, PENCIL)).toThrow("Say what is different");
  });

  it("accepts each fixed difference on its own", () => {
    for (const exception of [
      REMARQUE,
      { dedicated: true as const },
      { signature: INK },
      { condition: "margin_toning" as const },
    ]) {
      expect(() => assertPrintException(exception, PENCIL)).not.toThrow();
    }
  });

  it("refuses a signature that is how the run is signed", () => {
    expect(() => assertPrintException({ signature: PENCIL }, PENCIL)).toThrow(
      "Choose a different signature",
    );
  });

  it("refuses choices outside the fixed lists", () => {
    const bad = {
      remarque: { medium: "crayon", place: "lower_margin" },
    } as unknown as PrintException;
    expect(() => assertPrintException(bad, PENCIL)).toThrow("Choose what the remarque is drawn in");
    const place = { remarque: { medium: "ink", place: "middle" } } as unknown as PrintException;
    expect(() => assertPrintException(place, PENCIL)).toThrow("Choose where the remarque is");
    const note = { condition: "torn" } as unknown as PrintException;
    expect(() => assertPrintException(note, PENCIL)).toThrow("Choose a condition note");
  });

  it("lists the kinds in a fixed order", () => {
    expect(exceptionKinds({ condition: "margin_toning", dedicated: true, ...REMARQUE })).toEqual([
      "remarque",
      "dedication",
      "condition",
    ]);
  });
});

describe("assertRunHasNumberedPrints", () => {
  it("allows a numbered run and a proof listing", () => {
    expect(() => assertRunHasNumberedPrints(LAX_STANDARD_RUN)).not.toThrow();
    const proof: EditionRunSpec = {
      type: "proof",
      proofType: "ap",
      size: 2,
      owner: "artist",
      mainRunId: "m",
      proofsKeptOnMain: 2,
    };
    expect(() => assertRunHasNumberedPrints(proof)).not.toThrow();
  });

  it("refuses an open edition, which has no print to point at", () => {
    const open: EditionRunSpec = { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } };
    expect(() => assertRunHasNumberedPrints(open)).toThrow("open edition print has no number");
  });

  it("refuses a print that is already sold on its own", () => {
    expect(() =>
      assertRunHasNumberedPrints({ type: "set_apart", mainRunId: "m", owner: "lax" }),
    ).toThrow("already sold on its own");
  });
});

describe("setApartBlock", () => {
  it("lets an unsold print for sale be set apart, on sale or not yet", () => {
    expect(setApartBlock(state(), NOW)).toBeNull();
    expect(setApartBlock(state({ listingStatus: "not_authorised" }), NOW)).toBeNull();
  });

  it("blocks a sold print", () => {
    expect(setApartBlock(state({ listingStatus: "sold" }), NOW)).toEqual({ kind: "sold" });
  });

  it("blocks a print in a basket until the reservation ends, and says until when", () => {
    const until = new Date("2026-11-09T14:32:00Z");
    expect(setApartBlock(state({ listingStatus: "reserved", reservedUntil: until }), NOW)).toEqual({
      kind: "in_basket",
      until,
    });
  });

  it("blocks a lapsed reservation while an unpaid order still holds the print", () => {
    const until = new Date("2026-11-09T10:00:00Z");
    expect(
      setApartBlock(
        state({ listingStatus: "reserved", reservedUntil: until, reservedByPendingOrder: true }),
        NOW,
      ),
    ).toEqual({ kind: "in_basket", until });
  });

  it("allows a print whose reservation lapsed with no order behind it", () => {
    const until = new Date("2026-11-09T10:00:00Z");
    expect(
      setApartBlock(state({ listingStatus: "reserved", reservedUntil: until }), NOW),
    ).toBeNull();
  });

  it("blocks a held, a withdrawn, an unowned and an already separate print", () => {
    expect(setApartBlock(state({ listingStatus: "held" }), NOW)).toEqual({ kind: "held" });
    expect(setApartBlock(state({ listingStatus: "withdrawn" }), NOW)).toEqual({
      kind: "withdrawn",
    });
    expect(setApartBlock(state({ forSale: false }), NOW)).toEqual({ kind: "not_for_sale" });
    expect(setApartBlock(state({ alreadySetApart: true }), NOW)).toEqual({
      kind: "already_apart",
    });
  });

  it("reads a return the same way: only an unsold print goes back", () => {
    expect(
      returnBlock(
        { listingStatus: "authorised", reservedUntil: null, reservedByPendingOrder: false },
        NOW,
      ),
    ).toBeNull();
    expect(
      returnBlock(
        { listingStatus: "sold", reservedUntil: null, reservedByPendingOrder: false },
        NOW,
      ),
    ).toEqual({ kind: "sold" });
  });
});

describe("describeSetApartBlock", () => {
  it("says when a basket reservation ends", () => {
    const text = describeSetApartBlock(
      { kind: "in_basket", until: new Date("2026-11-09T14:32:00Z") },
      "7",
      () => "14:32 GMT",
    );
    expect(text.title).toBe("Print 7 is in a buyer's basket");
    expect(text.detail).toBe(
      "It is reserved until 14:32 GMT. Set it apart after the reservation ends, or choose another print.",
    );
  });

  it("has a sentence for every block", () => {
    for (const kind of ["sold", "held", "withdrawn", "not_for_sale", "already_apart"] as const) {
      const { title, detail } = describeSetApartBlock({ kind }, "3", () => "");
      expect(title).toContain("3");
      expect(detail.length).toBeGreaterThan(10);
    }
  });
});

describe("describeReturnBlock", () => {
  it("says why a sold print stays with its listing", () => {
    expect(describeReturnBlock({ kind: "sold" }, "3", () => "")).toEqual({
      title: "Print 3 is sold",
      detail: "A sold print stays with its listing, so the order keeps describing it.",
    });
  });

  it("says when a reservation ends and to return the print after it", () => {
    const text = describeReturnBlock(
      { kind: "in_basket", until: new Date("2026-11-09T14:32:00Z") },
      "3",
      () => "14:32 GMT",
    );
    expect(text.detail).toBe(
      "It is reserved until 14:32 GMT. Return it after the reservation ends.",
    );
  });

  it("has a sentence for every block", () => {
    for (const kind of ["held", "withdrawn", "not_for_sale", "already_apart"] as const) {
      expect(describeReturnBlock({ kind }, "3", () => "").detail.length).toBeGreaterThan(10);
    }
  });
});

describe("describePrintException", () => {
  it("writes the remarque from the fixed choices", () => {
    expect(describePrintException(REMARQUE)).toEqual({
      rows: ["Remarque: an original drawing added by the artist in pencil, lower margin"],
      items: [
        {
          label: "Remarque",
          value: "An original drawing added by the artist in pencil, lower margin",
        },
      ],
      basketParts: ["With a remarque"],
      invoiceParts: ["with a remarque in pencil, lower margin"],
    });
  });

  it("never names the person a print is dedicated to", () => {
    const text = describePrintException({ dedicated: true });
    expect(text.rows).toEqual(["Dedicated to a named person"]);
  });

  it("describes a signature that differs and a condition note", () => {
    const text = describePrintException({ signature: INK, condition: "small_crease_in_margin" });
    expect(text.rows).toEqual([
      "Signed differently from the rest of the edition",
      "Condition: a small crease in the margin",
    ]);
    expect(text.basketParts).toEqual(["Signed differently", "With a condition note"]);
  });
});

describe("naming the listing", () => {
  it("titles and addresses a set-apart print from its number and what differs", () => {
    expect(setApartListingTitle("Tide line", "no. 3", REMARQUE)).toBe(
      "Tide line (no. 3, with a remarque)",
    );
    expect(setApartListingSlug("tide-line", "No. 3")).toBe("tide-line-no-3");
    expect(describeSetApartAvailable("No. 3", REMARQUE)).toBe("No. 3, with a remarque");
  });

  it("names a numbered print and a proof", () => {
    const limited = setApartPrintFor(LAX_STANDARD_RUN, { editionNumber: 3 });
    expect(limited && setApartPrintText(limited)).toBe("No. 3");
    expect(limited && setApartPrintOf(limited)).toBe("No. 3 of 24");
    const proof = setApartPrintFor(
      {
        type: "proof",
        proofType: "ap",
        size: 3,
        owner: "artist",
        mainRunId: "m",
        proofsKeptOnMain: 3,
      },
      { proofNumber: 1 },
    );
    expect(proof && setApartPrintText(proof)).toBe("AP 1");
    expect(proof && setApartPrintOf(proof)).toBe("AP 1/3");
  });

  it("has no print to point at in an open edition", () => {
    expect(
      setApartPrintFor({ type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } }, {}),
    ).toBeNull();
  });
});

describe("a set-apart print on the page, in the basket and on the invoice", () => {
  const print = setApartPrintFor(LAX_STANDARD_RUN, { editionNumber: 3 });
  if (!print) throw new Error("expected a print");
  const described = describeEditionFacts(LAX_STANDARD_RUN, facts, {
    setApart: { print, exception: REMARQUE },
  });

  it("puts its number in the eyebrow and what differs in its own row", () => {
    expect(described.eyebrow).toBe("Limited edition print, no. 3 of 24");
    expect(described.rows.differences).toEqual([
      "Remarque: an original drawing added by the artist in pencil, lower margin",
    ]);
  });

  it("adds the number and the difference to the basket line", () => {
    expect(described.basketLine).toBe(
      "Limited edition of 24 · Hand-signed · Numbered · With certificate · No. 3 · With a remarque",
    );
  });

  it("leaves the card line and every other print unchanged", () => {
    const plain = describeEditionFacts(LAX_STANDARD_RUN, facts);
    expect(described.cardLine).toBe(plain.cardLine);
    expect(plain.rows.differences).toEqual([]);
    expect(plain.eyebrow).toBe("Limited edition print");
  });

  it("describes the invoice and the order line with the difference", () => {
    expect(described.invoiceDetail({ editionNumber: 3 })).toContain(
      "with a remarque in pencil, lower margin",
    );
    expect(described.orderLine({ editionNumber: 3 })).toContain("With a remarque");
  });

  it("says the same on the public edition, even before the facts are confirmed", () => {
    const page = describePublicEdition({
      run: { kind: "limited", size: 24 },
      facts: null,
      setApart: { print, exception: REMARQUE },
    });
    expect(page.eyebrow).toBe("Limited edition print, no. 3 of 24");
  });

  it("keeps the difference on the order, so a later change never rewrites it", () => {
    const snapshot = createEditionSnapshot({
      run: LAX_STANDARD_RUN,
      proofsKept: null,
      facts,
      exception: REMARQUE,
    });
    const read = readEditionSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(read?.exception).toEqual(REMARQUE);
    expect(describeSnapshotPrint(read ?? failure(), { editionNumber: 3 })?.invoiceDetail).toContain(
      "with a remarque",
    );
  });

  it("reads an order with no difference as before", () => {
    const snapshot = createEditionSnapshot({ run: LAX_STANDARD_RUN, proofsKept: null, facts });
    expect(readEditionSnapshot(JSON.parse(JSON.stringify(snapshot)))?.exception).toBeNull();
  });
});

function failure(): never {
  throw new Error("snapshot did not read back");
}
