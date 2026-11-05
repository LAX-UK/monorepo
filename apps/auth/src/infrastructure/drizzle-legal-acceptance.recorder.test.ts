import { LEGAL_DOCUMENT_SETS } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { legalAcceptanceRows } from "./drizzle-legal-acceptance.recorder.js";

const AT = new Date("2026-11-04T10:00:00Z");

describe("legalAcceptanceRows", () => {
  it("records the Terms and the Privacy notice of London Art Exchange for LAX Shop", () => {
    const set = LEGAL_DOCUMENT_SETS["london-art-exchange"];
    expect(
      legalAcceptanceRows({ subjectId: "u1", product: "shop", source: "hosted_sign_up" }, AT),
    ).toEqual([
      {
        subjectId: "u1",
        documentKind: "terms",
        documentVersion: set.terms.version,
        documentEffectiveOn: set.terms.effectiveOn,
        legalEntity: "london-art-exchange",
        product: "shop",
        source: "hosted_sign_up",
        acceptedAt: AT,
      },
      {
        subjectId: "u1",
        documentKind: "privacy",
        documentVersion: set.privacy.version,
        documentEffectiveOn: set.privacy.effectiveOn,
        legalEntity: "london-art-exchange",
        product: "shop",
        source: "hosted_sign_up",
        acceptedAt: AT,
      },
    ]);
  });

  it.each([
    ["bid", "london-auction-xchange"],
    ["account", "london-auction-xchange"],
    ["shop", "london-art-exchange"],
    ["art", "london-art-exchange"],
  ] as const)("names the company whose documents %s showed", (product, entity) => {
    const rows = legalAcceptanceRows({ subjectId: "u1", product, source: "social_sign_up" }, AT);
    expect(rows.map((row) => row.legalEntity)).toEqual([entity, entity]);
    expect(rows.map((row) => row.source)).toEqual(["social_sign_up", "social_sign_up"]);
    expect(rows.map((row) => row.documentKind)).toEqual(["terms", "privacy"]);
  });
});
