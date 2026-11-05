import { describe, expect, it } from "vitest";
import type { EditionFacts } from "./edition-facts.js";
import { type EditionRunSpec, LAX_STANDARD_RUN } from "./edition-run.js";
import {
  createEditionSnapshot,
  describeCertificateStatus,
  describeSnapshotPrint,
  readEditionSnapshot,
} from "./edition-snapshot.js";

const facts = (overrides: Partial<EditionFacts> = {}): EditionFacts => ({
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: {
    kind: "included",
    issuer: "artist",
    form: "paper",
    arrives: { kind: "with_print" },
    numberedToMatch: true,
  },
  confirmed: { by: "staff-1", at: new Date("2026-10-28T09:00:00Z") },
  ...overrides,
});

const NO_PROOFS = { ap: 0, pp: 0, hc: 0, bat: 0 };

function roundTrip(run: EditionRunSpec, value: EditionFacts | null) {
  const stored = JSON.parse(
    JSON.stringify(createEditionSnapshot({ run, proofsKept: NO_PROOFS, facts: value })),
  );
  return readEditionSnapshot(stored);
}

describe("edition snapshot", () => {
  it("survives being stored as JSON, dates included", () => {
    const read = roundTrip(LAX_STANDARD_RUN, facts());
    expect(read?.run).toEqual(LAX_STANDARD_RUN);
    expect(read?.facts?.confirmed?.at).toEqual(new Date("2026-10-28T09:00:00Z"));
    expect(read?.proofsKept).toEqual(NO_PROOFS);
  });

  it("describes the print the way the buyer was told at payment", () => {
    const read = roundTrip(LAX_STANDARD_RUN, facts());
    expect(read && describeSnapshotPrint(read, { editionNumber: 7 })).toEqual({
      summary: "No. 7 of 24 · Hand-signed · Certificate from the artist",
      invoiceDetail:
        "Limited edition of 24, no. 7, signed by hand, with certificate of authenticity",
    });
  });

  it("names no number when none is given", () => {
    const read = roundTrip(LAX_STANDARD_RUN, facts());
    expect(read && describeSnapshotPrint(read)?.summary).toBe(
      "Limited edition of 24 · Hand-signed · Certificate from the artist",
    );
  });

  it("describes nothing when the snapshot holds no facts", () => {
    const read = roundTrip(LAX_STANDARD_RUN, null);
    expect(read?.facts).toBeNull();
    expect(read && describeSnapshotPrint(read, { editionNumber: 7 })).toBeNull();
  });

  it("drops facts that do not fit the run but keeps the run", () => {
    const stored = createEditionSnapshot({
      run: { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } },
      proofsKept: null,
      facts: facts({ numbering: "on_print" }),
    });
    const read = readEditionSnapshot(JSON.parse(JSON.stringify(stored)));
    expect(read?.run.type).toBe("open");
    expect(read?.facts).toBeNull();
  });

  it.each([
    ["nothing", null],
    ["a string", "snapshot"],
    ["an array", []],
    ["another version", { schemaVersion: 2, run: LAX_STANDARD_RUN, facts: null }],
    ["a run without a type", { schemaVersion: 1, run: {}, facts: null }],
    ["an invalid run", { schemaVersion: 1, run: { type: "custom_limited", size: 1 }, facts: null }],
  ])("reads %s as no snapshot", (_name, raw) => {
    expect(readEditionSnapshot(raw)).toBeNull();
  });
});

describe("describeCertificateStatus", () => {
  const status = (overrides: Partial<Parameters<typeof describeCertificateStatus>[0]> = {}) =>
    describeCertificateStatus({ facts: facts(), issued: false, printLabel: "7/24", ...overrides });

  const separately = (withinWeeks: number) =>
    facts({
      certificate: {
        kind: "included",
        issuer: "publisher",
        form: "paper",
        arrives: { kind: "separately", withinWeeks },
        numberedToMatch: true,
      },
    });

  it("numbers an issued certificate that is numbered to match", () => {
    expect(status({ issued: true })).toEqual({
      label: "Certificate of authenticity No. 7/24",
      expectedNote: null,
    });
  });

  it("does not number a certificate of an unnumbered run", () => {
    const unnumbered = facts({ numbering: "none" });
    expect(status({ facts: unnumbered, issued: true, printLabel: "OE-0021" })?.label).toBe(
      "Certificate of authenticity",
    );
  });

  it("says a certificate comes with the print", () => {
    expect(status()?.expectedNote).toBe("Your certificate comes with your print.");
  });

  it("says when a certificate is sent separately", () => {
    expect(status({ facts: separately(4) })?.expectedNote).toBe(
      "Your certificate is sent separately, within 4 weeks of delivery.",
    );
    expect(status({ facts: separately(1) })?.expectedNote).toContain("within 1 week of");
  });

  it("says a digital certificate is added to the account", () => {
    const digital = facts({
      certificate: {
        kind: "included",
        issuer: "lax",
        form: "digital",
        arrives: { kind: "with_print" },
        numberedToMatch: true,
      },
    });
    expect(status({ facts: digital })?.expectedNote).toBe(
      "Your digital certificate is added here once your print is confirmed.",
    );
  });

  it("has no row when no certificate was promised or issued", () => {
    expect(status({ facts: facts({ certificate: { kind: "none" } }) })).toBeNull();
    expect(status({ facts: null })).toBeNull();
  });

  it("keeps the earlier expectation for prints with no recorded facts", () => {
    expect(status({ facts: null, legacyExpected: true })).toEqual({
      label: "Certificate of authenticity",
      expectedNote: "Your certificate appears here once it has been issued.",
    });
    expect(status({ facts: null, issued: true })?.expectedNote).toBeNull();
  });
});
