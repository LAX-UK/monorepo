import { describe, expect, it } from "vitest";
import {
  ADMIN_ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  hasActiveOrderFilters,
  orderBuyerName,
  orderBuyerSecondary,
  orderListApiQuery,
  orderListHref,
  orderListPageHref,
  orderNumber,
  orderStatusTone,
  parseOrderListQuery,
} from "./order-list.vm";

describe("parseOrderListQuery", () => {
  it("reads every filter", () => {
    expect(
      parseOrderListQuery({
        q: " ada ",
        status: "paid",
        from: "2026-03-01",
        to: "2026-03-31",
        cursor: "abc",
      }),
    ).toEqual({ q: "ada", status: "paid", from: "2026-03-01", to: "2026-03-31", cursor: "abc" });
  });

  it("drops unknown statuses, malformed dates and blanks", () => {
    expect(
      parseOrderListQuery({ q: " ", status: "shipped", from: "yesterday", to: ["2026-13-01x"] }),
    ).toEqual({});
  });

  it("takes the first of a repeated parameter", () => {
    expect(parseOrderListQuery({ status: ["refunded", "paid"] })).toEqual({ status: "refunded" });
  });
});

describe("hasActiveOrderFilters", () => {
  it("counts filters but not paging", () => {
    expect(hasActiveOrderFilters({})).toBe(false);
    expect(hasActiveOrderFilters({ cursor: "abc" })).toBe(false);
    expect(hasActiveOrderFilters({ from: "2026-03-01" })).toBe(true);
    expect(hasActiveOrderFilters({ q: "ada" })).toBe(true);
  });
});

describe("orderListHref", () => {
  it("returns to the first page when a filter changes", () => {
    expect(orderListHref({ status: "paid", cursor: "abc" }, { q: "ada" })).toBe(
      "/orders?status=paid&q=ada",
    );
  });

  it("clears a field with null and ends at the bare path when nothing is left", () => {
    expect(orderListHref({ status: "paid" }, { status: null })).toBe("/orders");
  });

  it("builds the next page link under the same filters", () => {
    expect(orderListPageHref({ status: "paid", q: "a b" }, "next")).toBe(
      "/orders?status=paid&q=a+b&cursor=next",
    );
  });
});

describe("orderListApiQuery", () => {
  it("renames the date parameters for the API and leaves out blanks", () => {
    expect(
      orderListApiQuery({ q: "ada", status: "paid", from: "2026-03-01", cursor: "abc" }),
    ).toEqual({ q: "ada", status: "paid", createdFrom: "2026-03-01" });
  });

  it("swaps a range that was picked back to front", () => {
    expect(orderListApiQuery({ from: "2026-03-31", to: "2026-03-01" })).toEqual({
      createdFrom: "2026-03-01",
      createdTo: "2026-03-31",
    });
  });

  it("is empty when nothing is filtered", () => {
    expect(orderListApiQuery({})).toEqual({});
  });
});

describe("order labels", () => {
  it("labels every status", () => {
    for (const status of ADMIN_ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it("marks the states staff must notice", () => {
    expect(orderStatusTone("paid")).toBe("success");
    expect(orderStatusTone("payment_failed")).toBe("danger");
    expect(orderStatusTone("pending_payment")).toBe("warning");
    expect(orderStatusTone("expired")).toBe("neutral");
  });

  it("quotes the order number as the first eight characters of the id", () => {
    expect(orderNumber("a1b2c3d4-0000-4000-8000-000000000000")).toBe("a1b2c3d4");
  });

  it("names the buyer by name, then email, then falls back", () => {
    expect(orderBuyerName({ buyerName: "Ada", buyerEmail: "ada@example.com" })).toBe("Ada");
    expect(orderBuyerName({ buyerName: null, buyerEmail: "ada@example.com" })).toBe(
      "ada@example.com",
    );
    expect(orderBuyerName({ buyerName: " ", buyerEmail: null })).toBe("Unknown buyer");
    expect(orderBuyerSecondary({ buyerName: "Ada", buyerEmail: "ada@example.com" })).toBe(
      "ada@example.com",
    );
    expect(orderBuyerSecondary({ buyerName: null, buyerEmail: "ada@example.com" })).toBeNull();
  });
});
