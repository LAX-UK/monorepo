import { describe, expect, it } from "vitest";
import { BID_ORG_ID, SHOP_ORG_ID, rawOrgSettings } from "../testing/org-fixtures.js";
import { parseBooksDestinationBinding } from "./destination-binding.js";
import { parseOrgConfigs } from "./org-config.js";

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
  it("binds nothing when no binding is given", () => {
    expect(parseBooksDestinationBinding(undefined, orgs())).toEqual({});
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

  it("refuses an id that is not the organisation configured for the product", () => {
    expect(
      code(() => parseBooksDestinationBinding({ test_org: { bid: SHOP_ORG_ID } }, orgs())),
    ).toBe("destination_binding_unknown_org");
    expect(
      code(() => parseBooksDestinationBinding({ test_org: { bid: "123456789" } }, orgs())),
    ).toBe("destination_binding_unknown_org");
    const withoutBid = parseOrgConfigs(rawOrgSettings({ withoutBid: true }));
    expect(
      code(() => parseBooksDestinationBinding({ test_org: { bid: BID_ORG_ID } }, withoutBid)),
    ).toBe("destination_binding_unknown_org");
  });

  it("refuses a binding of the wrong shape", () => {
    expect(code(() => parseBooksDestinationBinding({ dry_run: { bid: BID_ORG_ID } }, orgs()))).toBe(
      "destination_binding_invalid",
    );
  });
});
