import { describe, expect, it } from "vitest";
import {
  ADMIN_ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  dailyAveragePence,
  hasActiveOrderFilters,
  orderBuyerAccountLabel,
  orderBuyerName,
  orderBuyerSecondary,
  orderListApiQuery,
  orderListHref,
  orderListPageHref,
  orderMetrics,
  orderMetricsPeriod,
  orderNumber,
  orderStatusTone,
  orderTeamViews,
  parseOrderListQuery,
} from "./order-list.vm";

describe("orderMetrics", () => {
  const summary = {
    periodDays: 30,
    paidPence: { daily: [0, 18500, 4200], current: 22700, prior: 20000 },
    orders: { daily: [1, 2, 0], current: 3, prior: 3 },
    paidOrders: { daily: [0, 1, 1], current: 2, prior: 4 },
  };

  it("shows what was paid and placed with their trends, and the average paid order", () => {
    const metrics = orderMetrics(summary);
    expect(metrics.map((metric) => [metric.label, metric.value])).toEqual([
      ["Paid", "£227.00"],
      ["Orders placed", "3"],
      ["Average paid order", "£113.50"],
    ]);
    expect(metrics[0]?.trend).toEqual([0, 18500, 4200]);
    expect(metrics[0]?.comparison).toEqual({
      text: "14%",
      direction: "up",
      tone: "positive",
      basis: "vs previous 30 days",
    });
    expect(metrics[1]?.comparison?.direction).toBe("flat");
    // £113.50 now against £50.00 before.
    expect(metrics[2]?.comparison).toMatchObject({ text: "127%", direction: "up" });
    // No order on the first day: it starts from the previous window's £50.00.
    expect(metrics[2]?.trend).toEqual([5000, 18500, 4200]);
    expect(orderMetricsPeriod(summary)).toBe("All orders · last 30 days");
  });

  it("leaves out a change with nothing before it, and an average with no paid orders", () => {
    const metrics = orderMetrics({
      ...summary,
      paidPence: { daily: [0, 0, 0], current: 0, prior: 0 },
      paidOrders: { daily: [0, 0, 0], current: 0, prior: 0 },
    });
    expect(metrics[0]?.comparison).toBeUndefined();
    expect(metrics[2]?.value).toBeNull();
    expect(metrics[2]?.comparison).toBeUndefined();
    expect(metrics[2]?.trend).toBeUndefined();
  });

  it("keeps the last day's average through days without a paid order", () => {
    expect(
      dailyAveragePence(
        {
          ...summary,
          paidPence: { daily: [0, 9000, 0, 3000], current: 12000, prior: 0 },
          paidOrders: { daily: [0, 2, 0, 1], current: 3, prior: 0 },
        },
        0,
      ),
    ).toEqual([4500, 4500, 4500, 3000]);
  });
});

describe("orderTeamViews", () => {
  const views = orderTeamViews(new Date("2026-03-10T12:00:00Z"));

  it("offers a status over a recent period, dated from the given day", () => {
    expect(views.map((view) => [view.label, view.query])).toEqual([
      ["Paid this week", "status=paid&from=2026-03-04&to=2026-03-10"],
      ["Awaiting payment this week", "status=pending_payment&from=2026-03-04&to=2026-03-10"],
      ["Payment failed this month", "status=payment_failed&from=2026-02-09&to=2026-03-10"],
      ["Refunded this month", "status=refunded&from=2026-02-09&to=2026-03-10"],
    ]);
  });

  it("links each view to the list with exactly its query, so the list recognises it as active", () => {
    for (const view of views) {
      expect(view.href).toBe(`/orders?${view.query}`);
      expect(
        orderListHref(
          parseOrderListQuery(Object.fromEntries(new URLSearchParams(view.query))),
        ).split("?")[1],
      ).toBe(view.query);
    }
  });

  it("gives every view its own id", () => {
    expect(new Set(views.map((view) => view.id)).size).toBe(views.length);
  });
});

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

  it("quotes the order by its reference, or the first eight characters of the id without one", () => {
    expect(orderNumber("a1b2c3d4-0000-4000-8000-000000000000", "LAX-S-10482")).toBe("LAX-S-10482");
    expect(orderNumber("a1b2c3d4-0000-4000-8000-000000000000")).toBe("a1b2c3d4");
    expect(orderNumber("a1b2c3d4-0000-4000-8000-000000000000", null)).toBe("a1b2c3d4");
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

  it("marks a guest checkout order as a guest, with the email given at checkout", () => {
    expect(
      orderBuyerSecondary({ buyerName: "Ada", buyerEmail: "ada@example.com", buyerIsGuest: true }),
    ).toBe("Guest · ada@example.com");
    expect(
      orderBuyerSecondary({ buyerName: null, buyerEmail: "ada@example.com", buyerIsGuest: true }),
    ).toBe("Guest");
    expect(orderBuyerAccountLabel({ buyerIsGuest: true })).toBe("Guest checkout, no LAX account");
    expect(orderBuyerAccountLabel({})).toBe("LAX Account");
  });
});
