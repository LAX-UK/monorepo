import { type EditionFacts, LAX_STANDARD_RUN, createEditionSnapshot } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { describeOrderLineEdition, describeReceiptEdition } from "./order-line-edition.js";

const handSigned: EditionFacts = {
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: { kind: "none" },
  confirmed: { by: "staff", at: new Date("2026-10-28T09:00:00Z") },
};
const unsigned: EditionFacts = {
  numbering: "none",
  signature: { kind: "unsigned" },
  certificate: { kind: "none" },
  confirmed: { by: "staff", at: new Date("2026-10-28T09:00:00Z") },
};

const liveOf = (facts: EditionFacts | null) =>
  createEditionSnapshot({ run: LAX_STANDARD_RUN, proofsKept: null, facts });
/** As the database hands it back. */
const storedOf = (facts: EditionFacts | null) => JSON.parse(JSON.stringify(liveOf(facts)));

const base = { holdsPrint: true, editionNumber: 7, proofNumber: null } as const;

describe("describeOrderLineEdition", () => {
  it("names the number of a print the paid order holds", () => {
    expect(
      describeOrderLineEdition({ ...base, snapshot: storedOf(handSigned), live: undefined }),
    ).toMatchObject({ summary: "No. 7 of 24 · Hand-signed" });
  });

  it("prefers the facts kept at payment over the facts today", () => {
    const described = describeOrderLineEdition({
      ...base,
      snapshot: storedOf(handSigned),
      live: liveOf(unsigned),
    });
    expect(described?.summary).toBe("No. 7 of 24 · Hand-signed");
    expect(described?.invoiceDetail).toBe("Limited edition of 24, no. 7, signed by hand");
  });

  it("uses today's facts while the order has no snapshot", () => {
    expect(
      describeOrderLineEdition({
        ...base,
        holdsPrint: false,
        snapshot: null,
        live: liveOf(handSigned),
      })?.summary,
    ).toBe("Limited edition of 24 · Hand-signed");
  });

  it("names no number once the order no longer holds the print", () => {
    expect(
      describeOrderLineEdition({
        ...base,
        holdsPrint: false,
        snapshot: storedOf(handSigned),
        live: undefined,
      })?.summary,
    ).toBe("Limited edition of 24 · Hand-signed");
  });

  it("is null when no facts were recorded", () => {
    expect(
      describeOrderLineEdition({ ...base, snapshot: storedOf(null), live: undefined }),
    ).toBeNull();
    expect(describeOrderLineEdition({ ...base, snapshot: null, live: undefined })).toBeNull();
  });

  it("ignores a damaged snapshot and falls back to today's facts", () => {
    expect(
      describeOrderLineEdition({
        ...base,
        snapshot: { schemaVersion: 9 },
        live: liveOf(unsigned),
      })?.summary,
    ).toBe("Limited edition of 24 · Unsigned · Not numbered");
  });
});

describe("describeReceiptEdition", () => {
  it("gives the facts the buyer was told, with their number", () => {
    expect(
      describeReceiptEdition({ ...base, snapshot: storedOf(handSigned), live: undefined }),
    ).toBe("No. 7 of 24 · Hand-signed");
  });

  it("falls back to the print's label while the run has no recorded facts", () => {
    expect(describeReceiptEdition({ ...base, snapshot: storedOf(null), live: undefined })).toBe(
      "7/24",
    );
  });

  it("labels a proof by its proof number", () => {
    const proofRun = {
      type: "proof",
      proofType: "ap",
      size: 3,
      owner: "artist",
      mainRunId: "main",
      proofsKeptOnMain: 3,
    } as const;
    const snapshot = createEditionSnapshot({ run: proofRun, proofsKept: null, facts: null });
    expect(
      describeReceiptEdition({
        snapshot,
        live: undefined,
        holdsPrint: true,
        editionNumber: null,
        proofNumber: 2,
      }),
    ).toBe("AP 2/3");
  });

  it("says nothing when the run is unknown, the print has no number or the order does not hold it", () => {
    expect(describeReceiptEdition({ ...base, snapshot: null, live: undefined })).toBeNull();
    expect(
      describeReceiptEdition({
        ...base,
        editionNumber: null,
        snapshot: storedOf(null),
        live: undefined,
      }),
    ).toBeNull();
    expect(
      describeReceiptEdition({
        ...base,
        holdsPrint: false,
        snapshot: storedOf(null),
        live: undefined,
      }),
    ).toBeNull();
  });
});
