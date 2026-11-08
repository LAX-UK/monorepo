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

  it("are dated versions: the contact email change is 1.1 with a change log, the cookie notice is untouched", () => {
    for (const policy of Object.values(LAX_ART_POLICIES)) {
      if (policy.slug === "cookies") {
        expect(policy.release.version).toBe("1.0");
        expect(policy.release.lastUpdated).toBe("2026-08-12");
        expect(policy.release.changeLog).toBeUndefined();
        continue;
      }
      expect(policy.release.version, policy.slug).toBe("1.1");
      expect(policy.release.lastUpdated, policy.slug).toBe("2026-11-09");
      expect(policy.release.changeLog, policy.slug).toEqual([
        {
          version: "1.1",
          date: "2026-11-09",
          summary: "Contact email changed to info@thelax.art.",
        },
      ]);
    }
  });

  it("quote the contact email as info@thelax.art and no other lax.art address", () => {
    for (const policy of Object.values(LAX_ART_POLICIES)) {
      const text = legalPolicyTexts(policy.document).join("\n");
      expect(text, policy.slug).not.toContain("info@lax.art");
    }
  });

  it("name the company and its registration as published", () => {
    const terms = legalPolicyTexts(LAX_ART_POLICIES.terms.document).join("\n");
    expect(terms).toContain(
      "We are registered in England and Wales under company number 12874213.",
    );
  });
});
