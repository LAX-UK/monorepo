import { describe, expect, it } from "vitest";
import {
  bulkLotsFailureMessage,
  bulkLotsHasConnectRequired,
  bulkLotsPartialSuccessMessage,
  bulkPublishPreflightWarning,
  parseBulkLotsApiResponse,
} from "./lot-bulk-result";

describe("parseBulkLotsApiResponse", () => {
  it("reads structured errors from API envelope", () => {
    expect(
      parseBulkLotsApiResponse({
        data: {
          attempted: 5,
          failed: 2,
          errors: [
            { lotId: "id1", message: "boom" },
            { lotId: "id2", message: "bad", code: "connect_required" },
          ],
        },
      }),
    ).toEqual({
      attempted: 5,
      failed: 2,
      succeeded: 3,
      errors: [
        { lotId: "id1", message: "boom" },
        { lotId: "id2", message: "bad", code: "connect_required" },
      ],
    });
  });

  it("parses legacy string errors", () => {
    expect(
      parseBulkLotsApiResponse({
        data: { attempted: 2, failed: 1, errors: ["id1: connect blocked"] },
      }),
    ).toEqual({
      attempted: 2,
      failed: 1,
      succeeded: 1,
      errors: [{ lotId: "id1", message: "connect blocked" }],
    });
  });

  it("returns null for unexpected bodies", () => {
    expect(parseBulkLotsApiResponse(null)).toBeNull();
    expect(parseBulkLotsApiResponse({ ok: true })).toBeNull();
  });
});

describe("bulk lot messages", () => {
  it("formats partial success copy with connect_required", () => {
    expect(
      bulkLotsPartialSuccessMessage("Publish", {
        attempted: 4,
        failed: 1,
        succeeded: 3,
        errors: [{ lotId: "lot-1", message: "blocked", code: "connect_required" }],
      }),
    ).toContain("payout setup");
  });

  it("formats total failure copy for connect_required", () => {
    expect(
      bulkLotsFailureMessage({
        attempted: 2,
        failed: 2,
        succeeded: 0,
        errors: [{ lotId: "lot-1", message: "x", code: "connect_required" }],
      }),
    ).toContain("payout setup");
  });

  it("detects connect_required in error list", () => {
    expect(
      bulkLotsHasConnectRequired({
        attempted: 1,
        failed: 1,
        succeeded: 0,
        errors: [{ lotId: "lot-1", message: "x", code: "connect_required" }],
      }),
    ).toBe(true);
  });

  it("formats total failure copy for use_sale_publish", () => {
    expect(
      bulkLotsFailureMessage({
        attempted: 2,
        failed: 2,
        succeeded: 0,
        errors: [{ lotId: "lot-1", message: "blocked", code: "use_sale_publish" }],
      }),
    ).toContain("published together");
  });

  it("formats partial success copy for use_sale_publish", () => {
    expect(
      bulkLotsPartialSuccessMessage("Publish", {
        attempted: 3,
        failed: 1,
        succeeded: 2,
        errors: [{ lotId: "lot-1", message: "blocked", code: "use_sale_publish" }],
      }),
    ).toContain("published together");
  });

  it("builds bulk publish preflight warning for connect and sale-assigned lots", () => {
    const lot = {
      id: "lot-1",
      saleId: "sale-1",
      sellerLegalEntityId: "seller-1",
    } as import("@auction/types").Lot;
    expect(bulkPublishPreflightWarning(["lot-1"], [lot], { "lot-1": true })).toContain(
      "payout setup",
    );
    expect(bulkPublishPreflightWarning(["lot-1"], [lot], {})).toContain("published together");
  });
});
