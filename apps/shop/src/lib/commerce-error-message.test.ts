import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";

describe("commerceErrorMessage", () => {
  it("maps shop error codes", () => {
    expect(commerceErrorMessage({ code: SHOP_API_ERROR_CODES.PRICE_CHANGED }, "x")).toMatch(
      /price/i,
    );
    expect(commerceErrorMessage({ code: SHOP_API_ERROR_CODES.CONFLICT }, "x")).toMatch(
      /not accepting availability notifications/i,
    );
    expect(commerceErrorMessage({ code: SHOP_API_ERROR_CODES.OUT_OF_STOCK }, "x")).toMatch(
      /no longer available/i,
    );
    expect(commerceErrorMessage({ code: SHOP_API_ERROR_CODES.BASKET_CONFLICT }, "x")).toMatch(
      /another device/i,
    );
    expect(commerceErrorMessage({ code: SHOP_API_ERROR_CODES.NOT_FOUND }, "x")).toMatch(
      /could not find/i,
    );
    expect(commerceErrorMessage({ code: SHOP_API_ERROR_CODES.UNAUTHORIZED }, "x")).toMatch(
      /sign in/i,
    );
    expect(commerceErrorMessage({ code: SHOP_API_ERROR_CODES.FORBIDDEN }, "x")).toMatch(/sign in/i);
    expect(commerceErrorMessage({ code: SHOP_API_ERROR_CODES.VALIDATION }, "x")).toMatch(
      /check your details/i,
    );
    expect(commerceErrorMessage({ code: SHOP_API_ERROR_CODES.INTERNAL }, "x")).toMatch(
      /something went wrong/i,
    );
    expect(commerceErrorMessage({ code: SHOP_API_ERROR_CODES.PAYMENT_FAILED }, "x")).toMatch(
      /payment could not/i,
    );
    expect(commerceErrorMessage({ error: "csrf_failed" }, "x")).toMatch(/session expired/i);
    expect(commerceErrorMessage({ error: "sign_in_required" }, "x")).toMatch(/sign in/i);
  });

  it("unwraps commerce_upstream_failed wrappers", () => {
    expect(
      commerceErrorMessage(
        { error: "commerce_upstream_failed", code: SHOP_API_ERROR_CODES.CONFLICT },
        "fallback",
      ),
    ).toMatch(/not accepting availability notifications/i);
  });

  it("falls back for unknown payloads", () => {
    expect(commerceErrorMessage(null, "fallback")).toBe("fallback");
  });
});
