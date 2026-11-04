import { LAX_PRODUCT_NAMES, LEGAL_ENTITIES } from "@auction/branding";
import {
  LEGAL_DOCUMENT_PRODUCT_NAMES,
  LEGAL_DOCUMENT_SETS,
  LEGAL_ENTITY_NAMES,
} from "@auction/identity-contracts";
import { LAX_ART_POLICIES } from "@auction/marketing-ui";
import { describe, expect, it } from "vitest";

/**
 * Account sign-up records the version of the Terms and Privacy notice a person accepted. For
 * London Art Exchange those versions are kept in the Identity contract, so they must name what
 * the policy pages publish.
 */
describe("London Art Exchange documents recorded at sign-up", () => {
  const recorded = LEGAL_DOCUMENT_SETS["london-art-exchange"];

  it.each([
    ["terms", recorded.terms],
    ["privacy", recorded.privacy],
  ] as const)("records the published %s version and date", (slug, document) => {
    expect(document.version).toBe(LAX_ART_POLICIES[slug].release.version);
    expect(document.effectiveOn).toBe(LAX_ART_POLICIES[slug].release.lastUpdated);
  });
});

describe("names written into the sign-up record", () => {
  it("match the registered company names", () => {
    for (const entity of Object.values(LEGAL_ENTITIES)) {
      expect(LEGAL_ENTITY_NAMES[entity.id]).toBe(entity.name);
    }
  });

  it("match the product names", () => {
    expect(LEGAL_DOCUMENT_PRODUCT_NAMES).toEqual(LAX_PRODUCT_NAMES);
  });
});
