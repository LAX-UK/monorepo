import { TypeCompiler } from "@sinclair/typebox/compiler";
import { describe, expect, it } from "vitest";
import {
  AdminEditionFactsSaveBodySchema,
  AdminNewRunInputSchema,
  AdminProofListingBodySchema,
  AdminStockBatchBodySchema,
} from "./edition-run-admin.js";

const facts = {
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: {
    kind: "included",
    issuer: "artist",
    form: "paper",
    arrives: { kind: "with_print" },
    numberedToMatch: true,
  },
} as const;

describe("edition run admin contracts", () => {
  const run = TypeCompiler.Compile(AdminNewRunInputSchema);

  it("accepts each kind of main run, with or without facts", () => {
    expect(run.Check({ spec: { type: "lax_standard" } })).toBe(true);
    expect(
      run.Check({
        spec: { type: "custom_limited", size: 40, allocation: { buyer: 0, artist: 30, lax: 10 } },
        proofsKept: { ap: 3, pp: 1, hc: 0, bat: 0 },
        facts,
        factsConfirmed: true,
      }),
    ).toBe(true);
    expect(
      run.Check({
        spec: { type: "open", defaultArtistPct: 50 },
        firstBatch: { artistCount: 10, laxCount: 10, custody: "unprinted" },
      }),
    ).toBe(true);
  });

  it("leaves the size rule to the domain, so its wording reaches staff", () => {
    expect(
      run.Check({
        spec: { type: "custom_limited", size: 501, allocation: { buyer: 0, artist: 501, lax: 0 } },
      }),
    ).toBe(true);
  });

  it("refuses a signature with a medium it does not take, and unknown fields", () => {
    const save = TypeCompiler.Compile(AdminEditionFactsSaveBodySchema);
    expect(save.Check({ facts, confirmed: false, expectedFactsVersion: null })).toBe(true);
    expect(
      save.Check({
        facts: { ...facts, signature: { kind: "unsigned", medium: "ink" } },
        confirmed: false,
        expectedFactsVersion: null,
      }),
    ).toBe(false);
    expect(save.Check({ facts, confirmed: true })).toBe(false);
  });

  it("bounds a stock batch and a proof listing", () => {
    const batch = TypeCompiler.Compile(AdminStockBatchBodySchema);
    expect(batch.Check({ artistCount: 5, laxCount: 5, custody: "stored" })).toBe(true);
    expect(batch.Check({ artistCount: 5, laxCount: 5, custody: "delivered" })).toBe(false);
    const proof = TypeCompiler.Compile(AdminProofListingBodySchema);
    expect(proof.Check({ proofType: "ap", count: 3, owner: "artist" })).toBe(true);
    expect(proof.Check({ proofType: "bat", count: 1, owner: "lax" })).toBe(false);
    expect(proof.Check({ proofType: "ap", count: 0, owner: "artist" })).toBe(false);
  });
});
