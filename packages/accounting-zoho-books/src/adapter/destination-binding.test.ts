import { describe, expect, it } from "vitest";
import { BID_ORG_ID, SHOP_ORG_ID, rawOrgSettings } from "../testing/org-fixtures.js";
import { parseBooksDestinationBinding } from "./destination-binding.js";
import { parseOrgConfigs } from "./org-config.js";
import { BOOKS_ORGANISATIONS } from "./organisations.js";

/** The fixture organisations, the Bid one stated as `bidEnvironment`. */
function orgs(bidEnvironment: "test" | "live" = "test") {
  const raw = rawOrgSettings() as Record<string, Record<string, unknown>>;
  return parseOrgConfigs({
    ...raw,
    london_auction_xchange: { ...raw.london_auction_xchange, environment: bidEnvironment },
  });
}

const code = (run: () => unknown) => {
  try {
    run();
    return "ok";
  } catch (error) {
    return (error as { code?: string }).code;
  }
};

describe("parseBooksDestinationBinding", () => {
  it("binds nothing when no organisation is named", () => {
    expect(parseBooksDestinationBinding(undefined, orgs())).toEqual({});
    expect(parseBooksDestinationBinding(BOOKS_ORGANISATIONS, orgs())).toEqual({});
  });

  it("binds each test_org product to its own test organisation", () => {
    const binding = { test_org: { bid: BID_ORG_ID, shop: SHOP_ORG_ID, lax_art: SHOP_ORG_ID } };
    expect(parseBooksDestinationBinding(binding, orgs())).toEqual(binding);
  });

  it("refuses the live organisation as a test_org target, and a test one as live", () => {
    expect(
      code(() => parseBooksDestinationBinding({ test_org: { bid: BID_ORG_ID } }, orgs("live"))),
    ).toBe("destination_binding_wrong_environment");
    expect(
      code(() => parseBooksDestinationBinding({ live: { bid: BID_ORG_ID } }, orgs("test"))),
    ).toBe("destination_binding_wrong_environment");
  });

  it("names both modes once: a deployment holding only the test organisations starts, and the live one is unreachable from it", () => {
    const named = { test_org: { bid: BID_ORG_ID }, live: { bid: "7700000000001" } };
    expect(parseBooksDestinationBinding(named, orgs("test"))).toEqual(named);
    // The live id configured here as a test organisation: refused, whatever the settings declare.
    const liveAsTest = { test_org: { bid: "7700000000002" }, live: { bid: BID_ORG_ID } };
    expect(code(() => parseBooksDestinationBinding(liveAsTest, orgs("test")))).toBe(
      "destination_binding_wrong_environment",
    );
  });

  it("refuses an organisation configured for another legal entity than the product's", () => {
    expect(
      code(() => parseBooksDestinationBinding({ test_org: { bid: SHOP_ORG_ID } }, orgs())),
    ).toBe("destination_binding_wrong_entity");
  });

  it("refuses names of the wrong shape, and one id under both modes", () => {
    expect(code(() => parseBooksDestinationBinding({ dry_run: { bid: BID_ORG_ID } }, orgs()))).toBe(
      "destination_binding_invalid",
    );
    expect(
      code(() =>
        parseBooksDestinationBinding(
          { test_org: { bid: BID_ORG_ID }, live: { bid: BID_ORG_ID } },
          orgs(),
        ),
      ),
    ).toBe("destination_binding_invalid");
  });
});
