import { describe, expect, it } from "vitest";
import {
  type Destination,
  type DestinationBinding,
  checkDestination,
  parseDestinationBinding,
} from "./destination.js";

const TEST_BID = "9000000000002";
const LIVE_BID = "8000000000002";
const binding: DestinationBinding = { test_org: { bid: TEST_BID }, live: { bid: LIVE_BID } };
const org = (organisationId: string): Destination => ({ kind: "organisation", organisationId });
const NONE: Destination = { kind: "none" };

const code = (result: ReturnType<typeof checkDestination>) =>
  result.ok ? "ok" : result.refusal.code;

describe("checkDestination", () => {
  it("lets a rehearsal through only when it reaches no organisation at all", () => {
    expect(code(checkDestination("dry_run", "bid", NONE, {}))).toBe("ok");
    expect(code(checkDestination("dry_run", "bid", org(TEST_BID), binding))).toBe(
      "rehearsal_reaches_organisation",
    );
    expect(code(checkDestination("dry_run", "bid", org(LIVE_BID), binding))).toBe(
      "rehearsal_reaches_organisation",
    );
  });

  it("sends a writing mode only to the organisation bound for that mode and product", () => {
    expect(code(checkDestination("test_org", "bid", org(TEST_BID), binding))).toBe("ok");
    expect(code(checkDestination("live", "bid", org(LIVE_BID), binding))).toBe("ok");
  });

  it("refuses the live organisation for a test_org document, and the reverse", () => {
    const wrong = checkDestination("test_org", "bid", org(LIVE_BID), binding);
    expect(wrong).toMatchObject({ ok: false, refusal: { code: "destination_mismatch" } });
    if (!wrong.ok) expect(wrong.refusal.message).toContain(LIVE_BID);
    expect(code(checkDestination("live", "bid", org(TEST_BID), binding))).toBe(
      "destination_mismatch",
    );
  });

  it("refuses a writing mode with nothing bound for the product, whatever the adapter says", () => {
    expect(code(checkDestination("test_org", "shop", org(TEST_BID), binding))).toBe(
      "destination_not_bound",
    );
    expect(code(checkDestination("live", "bid", org(LIVE_BID), {}))).toBe("destination_not_bound");
  });

  it("refuses a writing mode whose adapter cannot say where it sends, or reaches nothing", () => {
    const unconfigured: Destination = { kind: "unconfigured", reason: "not_set_up" };
    expect(code(checkDestination("test_org", "bid", unconfigured, binding))).toBe(
      "destination_unresolved",
    );
    expect(code(checkDestination("test_org", "bid", NONE, binding))).toBe("destination_unresolved");
  });
});

describe("parseDestinationBinding", () => {
  it("binds nothing when absent", () => {
    expect(parseDestinationBinding(undefined)).toEqual({ ok: true, value: {} });
  });

  it("reads organisation ids per writing mode and product", () => {
    expect(parseDestinationBinding({ test_org: { bid: TEST_BID, shop: "9000000000001" } })).toEqual(
      { ok: true, value: { test_org: { bid: TEST_BID, shop: "9000000000001" } } },
    );
  });

  it("refuses an organisation bound to both test_org and live", () => {
    expect(
      parseDestinationBinding({ test_org: { bid: LIVE_BID }, live: { shop: LIVE_BID } }),
    ).toMatchObject({ ok: false, refusal: { code: "bad_binding" } });
  });

  it("refuses dry_run, unknown modes and products, and ids that are not plain strings", () => {
    for (const input of [
      null,
      [],
      { dry_run: { bid: TEST_BID } },
      { off: {} },
      { test_org: { auctions: TEST_BID } },
      { test_org: { bid: 9000000000002 } },
      { test_org: { bid: "" } },
      { test_org: { bid: ` ${TEST_BID}` } },
      { test_org: [TEST_BID] },
    ]) {
      expect(parseDestinationBinding(input)).toMatchObject({ ok: false });
    }
  });
});
