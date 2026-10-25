import { describe, expect, it } from "vitest";
import { legalPolicyPlaceholders, legalPolicyTexts } from "../policy/policy-document.js";
import { LAX_ART_LEGAL_INDEX, LAX_ART_POLICIES, LAX_ART_POLICY_ORDER } from "./index.js";

describe("London Art Exchange Ltd policies", () => {
  it("lists every policy once in the legal index", () => {
    expect([...LAX_ART_POLICY_ORDER].sort()).toEqual(Object.keys(LAX_ART_POLICIES).sort());
    expect(new Set(LAX_ART_POLICY_ORDER).size).toBe(LAX_ART_POLICY_ORDER.length);
    expect(LAX_ART_LEGAL_INDEX.groups.map((group) => group.title)).toEqual([
      "Buying from us",
      "Your data",
      "Our standards",
    ]);
  });

  it("are published in full, with numbered sections and no placeholders", () => {
    for (const policy of Object.values(LAX_ART_POLICIES)) {
      expect(policy.release.status, policy.slug).toBe("approved");
      expect(policy.document.sections.length, policy.slug).toBeGreaterThan(0);
      expect(policy.document.sections[0]?.heading, policy.slug).toMatch(/^1\. /);
      expect(legalPolicyPlaceholders(policy.document), policy.slug).toEqual([]);
      expect(policy.artPath).toBe(`/legal/${policy.slug}`);
    }
  });

  it("name the company and its registration as published", () => {
    const terms = legalPolicyTexts(LAX_ART_POLICIES.terms.document).join("\n");
    expect(terms).toContain(
      "We are registered in England and Wales under company number 12874213.",
    );
  });
});
