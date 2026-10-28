import type { EditionFacts, EditionRunSpec, ProofsKept } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { factsFromColumns, factsToColumns } from "./edition-facts-columns.js";
import { runFromColumns, runToColumns } from "./edition-run-columns.js";

const NONE: ProofsKept = { ap: 0, pp: 0, hc: 0, bat: 0 };
const KEPT: ProofsKept = { ap: 3, pp: 2, hc: 1, bat: 1 };

const runs: Array<[string, EditionRunSpec, ProofsKept]> = [
  ["LAX standard", { type: "lax_standard" }, NONE],
  [
    "custom with proofs kept",
    {
      type: "custom_limited",
      size: 40,
      allocation: { buyer: 0, artist: 30, lax: 10 },
      linkedToOriginal: false,
    },
    KEPT,
  ],
  [
    "custom with buyer prints",
    {
      type: "custom_limited",
      size: 12,
      allocation: { buyer: 2, artist: 6, lax: 4 },
      linkedToOriginal: true,
    },
    NONE,
  ],
  ["open", { type: "open", defaultSplit: { artistPct: 70, laxPct: 30 } }, NONE],
  [
    "companion open",
    {
      type: "companion",
      mainRunId: "main-1",
      run: { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } },
    },
    NONE,
  ],
  [
    "companion standard",
    { type: "companion", mainRunId: "main-1", run: { type: "lax_standard" } },
    NONE,
  ],
];

const withIds = (columns: ReturnType<typeof runToColumns>, linked: boolean) => ({
  ...columns,
  id: "artwork-1",
  sourceOriginalArtworkId: linked ? "original-1" : null,
});

describe("run columns", () => {
  it.each(runs)("round-trips %s", (_name, spec, proofsKept) => {
    const linked = spec.type === "custom_limited" && spec.linkedToOriginal;
    const columns = runToColumns({ spec, proofsKept });
    expect(runFromColumns(withIds(columns, linked), null)).toEqual({
      artworkId: "artwork-1",
      spec,
      proofsKept,
    });
  });

  it("stores the LAX standard run as 24 prints, 10 buyer, 10 artist, 4 LAX", () => {
    expect(runToColumns({ spec: { type: "lax_standard" }, proofsKept: NONE })).toMatchObject({
      runKind: "limited",
      runRole: "main",
      runTemplate: "lax_standard",
      runSize: 24,
      allocBuyer: 10,
      allocArtist: 10,
      allocLax: 4,
      openDefaultArtistPct: null,
    });
  });

  it("stores an open run with no size or allocation and its default split", () => {
    expect(
      runToColumns({
        spec: { type: "open", defaultSplit: { artistPct: 60, laxPct: 40 } },
        proofsKept: NONE,
      }),
    ).toMatchObject({
      runKind: "open",
      runTemplate: null,
      runSize: null,
      allocBuyer: null,
      allocArtist: null,
      allocLax: null,
      openDefaultArtistPct: 60,
    });
  });

  it("stores a proof listing as a small limited run owned by one party and reads it back", () => {
    const spec: EditionRunSpec = {
      type: "proof",
      proofType: "pp",
      size: 2,
      owner: "lax",
      mainRunId: "main-1",
      proofsKeptOnMain: 2,
    };
    const columns = runToColumns({ spec, proofsKept: NONE });
    expect(columns).toMatchObject({
      runKind: "limited",
      runRole: "proof",
      runTemplate: null,
      runSize: 2,
      allocBuyer: 0,
      allocArtist: 0,
      allocLax: 2,
      proofType: "pp",
      mainRunArtworkId: "main-1",
    });
    expect(runFromColumns(withIds(columns, false), KEPT)?.spec).toEqual({
      ...spec,
      proofsKeptOnMain: 2,
    });
  });

  it("refuses to store a run that breaks a rule", () => {
    expect(() =>
      runToColumns({
        spec: {
          type: "custom_limited",
          size: 1,
          allocation: { buyer: 0, artist: 1, lax: 0 },
          linkedToOriginal: false,
        },
        proofsKept: NONE,
      }),
    ).toThrow("between 2 and 500");
  });

  it("reads an original as no run", () => {
    const original = {
      id: "o",
      sourceOriginalArtworkId: null,
      runKind: null,
      runRole: null,
      runTemplate: null,
      runSize: null,
      allocBuyer: null,
      allocArtist: null,
      allocLax: null,
      openDefaultArtistPct: null,
      mainRunArtworkId: null,
      proofType: null,
      proofsKeptAp: null,
      proofsKeptPp: null,
      proofsKeptHc: null,
      proofsKeptBat: null,
    };
    expect(runFromColumns(original, null)).toBeNull();
  });

  it("reports a stored run that is missing what its kind needs", () => {
    const base = runToColumns({
      spec: { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } },
      proofsKept: NONE,
    });
    expect(() =>
      runFromColumns(withIds({ ...base, openDefaultArtistPct: null }, false), null),
    ).toThrow("no default split");
    const proof = runToColumns({
      spec: {
        type: "proof",
        proofType: "ap",
        size: 1,
        owner: "artist",
        mainRunId: "m",
        proofsKeptOnMain: 1,
      },
      proofsKept: NONE,
    });
    expect(() => runFromColumns(withIds(proof, false), null)).toThrow(
      "missing its type, size or main run",
    );
  });
});

const NOW = new Date("2026-10-28T09:00:00Z");

const HAND_SIGNED_FACTS: EditionFacts = {
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: {
    kind: "included",
    issuer: "artist",
    form: "paper",
    arrives: { kind: "with_print" },
    numberedToMatch: true,
  },
  confirmed: { by: "staff-1", at: NOW },
};

const UNSIGNED_FACTS: EditionFacts = {
  numbering: "none",
  signature: { kind: "unsigned" },
  certificate: { kind: "none" },
  confirmed: null,
};

const facts: Array<[string, EditionFacts]> = [
  [
    "hand-signed with a paper certificate",
    {
      numbering: "on_print",
      signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
      certificate: {
        kind: "included",
        issuer: "artist",
        form: "paper",
        arrives: { kind: "with_print" },
        numberedToMatch: true,
      },
      confirmed: { by: "staff-1", at: NOW },
    },
  ],
  [
    "plate-signed, numbered on a digital certificate",
    {
      numbering: "on_certificate",
      signature: { kind: "plate_signed" },
      certificate: {
        kind: "included",
        issuer: "lax",
        form: "digital",
        arrives: { kind: "with_print" },
        numberedToMatch: true,
      },
      confirmed: null,
    },
  ],
  [
    "estate-signed, certificate sent later and not numbered to match",
    {
      numbering: "on_print",
      signature: { kind: "estate_signed", place: "back" },
      certificate: {
        kind: "included",
        issuer: "publisher",
        form: "both",
        arrives: { kind: "separately", withinWeeks: 4 },
        numberedToMatch: false,
        numberedToMatchReason: "The certificate lists the whole run",
      },
      confirmed: { by: "staff-2", at: NOW },
    },
  ],
  [
    "unsigned with no certificate",
    {
      numbering: "none",
      signature: { kind: "unsigned" },
      certificate: { kind: "none" },
      confirmed: null,
    },
  ],
  [
    "estate stamp",
    {
      numbering: "on_print",
      signature: { kind: "estate_stamped" },
      certificate: { kind: "none" },
      confirmed: null,
    },
  ],
];

describe("facts columns", () => {
  it.each(facts)("round-trips %s", (_name, value) => {
    expect(factsFromColumns(factsToColumns(value))).toEqual(value);
  });

  it("leaves unused signature and certificate columns empty", () => {
    expect(factsToColumns(UNSIGNED_FACTS)).toMatchObject({
      signatureKind: "unsigned",
      signatureMedium: null,
      signaturePlace: null,
      certificateKind: "none",
      certificateIssuer: null,
      certificateWithinWeeks: null,
      certificateNumberedToMatch: null,
    });
  });

  it("reports stored facts that are incomplete", () => {
    const hand = factsToColumns(HAND_SIGNED_FACTS);
    expect(() => factsFromColumns({ ...hand, signatureMedium: null })).toThrow(
      "signature is incomplete",
    );
    expect(() =>
      factsFromColumns({ ...factsToColumns(UNSIGNED_FACTS), certificateKind: "included" }),
    ).toThrow("certificate is incomplete");
  });
});
