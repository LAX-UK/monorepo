import { describe, expect, it } from "vitest";
import {
  ShopContractParseError,
  parsePortalSellerAccess,
  parseSaleAuthorityRequestWithdrawResponse,
} from "./parse-public.js";

describe("parseSaleAuthorityRequestWithdrawResponse", () => {
  it("accepts a cancelled request", () => {
    const body = { requestId: "550e8400-e29b-41d4-a716-446655440000", status: "cancelled" };
    expect(parseSaleAuthorityRequestWithdrawResponse(body)).toEqual(body);
  });

  it("rejects other statuses and non-uuid ids", () => {
    expect(() =>
      parseSaleAuthorityRequestWithdrawResponse({
        requestId: "550e8400-e29b-41d4-a716-446655440000",
        status: "pending",
      }),
    ).toThrow(ShopContractParseError);
    expect(() =>
      parseSaleAuthorityRequestWithdrawResponse({ requestId: "nope", status: "cancelled" }),
    ).toThrow(ShopContractParseError);
  });
});

describe("parsePortalSellerAccess", () => {
  it("accepts the three flags", () => {
    const body = { editions: true, payouts: false, artist: false };
    expect(parsePortalSellerAccess(body)).toEqual(body);
  });

  it("rejects a missing or non-boolean flag", () => {
    expect(() => parsePortalSellerAccess({ editions: true, payouts: false })).toThrow(
      ShopContractParseError,
    );
    expect(() =>
      parsePortalSellerAccess({ editions: "yes", payouts: false, artist: false }),
    ).toThrow(ShopContractParseError);
  });
});
