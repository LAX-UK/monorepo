import { describe, expect, it } from "vitest";
import { DELIVERIES_COPY } from "./deliveries-copy";
import {
  BOOKED_UNPAID,
  COLLECTED,
  DELIVERY_FIXTURE_NOW,
  ON_THE_WAY,
  REFUNDED,
  deliveryFixture,
} from "./deliveries.fixture";
import {
  deliveriesApiQuery,
  deliveriesFilterChips,
  deliveriesHref,
  deliveriesPagination,
  deliveriesRangeSummary,
  deliveryBadge,
  deliveryBadges,
  deliveryBuyerLine,
  deliveryLotTitle,
  deliveryPaidLine,
  deliveryPanelHref,
  deliveryPhoneMeta,
  deliveryPrice,
  deliverySaleLine,
  deliverySince,
  deliverySinceExact,
  deliveryTabs,
  deliveryTimeline,
  hasDeliveriesFilters,
  paddleLine,
  parseDeliveriesSearch,
} from "./deliveries.vm";

const now = new Date(DELIVERY_FIXTURE_NOW);
const SALE = "5a1e0000-0000-4000-8000-000000000001";
const LOT = "10700000-0000-4000-8000-000000000042";

describe("parseDeliveriesSearch", () => {
  it("opens on Waiting for a price, newest first, 50 rows, no panel", () => {
    expect(parseDeliveriesSearch({})).toEqual({
      view: "waiting",
      q: "",
      saleId: "",
      sort: "newest",
      limit: 50,
      offset: 0,
      record: null,
    });
  });

  it("reads a view, search, sale, order, page and open lot", () => {
    expect(
      parseDeliveriesSearch({
        view: "on_the_way",
        q: " Lyon ",
        sale: SALE,
        sort: "oldest",
        limit: "25",
        offset: "25",
        record: LOT,
      }),
    ).toEqual({
      view: "on_the_way",
      q: "Lyon",
      saleId: SALE,
      sort: "oldest",
      limit: 25,
      offset: 25,
      record: LOT,
    });
  });

  it("ignores what it does not know rather than failing", () => {
    expect(
      parseDeliveriesSearch({
        view: "requested",
        sale: "autumn",
        limit: "500",
        offset: "-4",
        record: "42",
      }),
    ).toMatchObject({ view: "waiting", saleId: "", limit: 50, offset: 0, record: null });
  });

  it("counts a search or sale as filtering, but not the tab or the order", () => {
    expect(hasDeliveriesFilters(parseDeliveriesSearch({ view: "closed", sort: "oldest" }))).toBe(
      false,
    );
    expect(hasDeliveriesFilters(parseDeliveriesSearch({ q: "Cork" }))).toBe(true);
    expect(hasDeliveriesFilters(parseDeliveriesSearch({ sale: SALE }))).toBe(true);
  });
});

describe("addresses", () => {
  it("asks the API for exactly the list's state", () => {
    const query = deliveriesApiQuery(
      parseDeliveriesSearch({ view: "quoted", q: "Cork", sale: SALE }),
    );
    expect(Object.fromEntries(query)).toEqual({
      view: "quoted",
      sort: "newest",
      limit: "50",
      offset: "0",
      q: "Cork",
      saleId: SALE,
    });
  });

  it("keeps the defaults out of the URL and starts a new view on its first page, panel closed", () => {
    const current = { view: "quoted", offset: "50", record: LOT, q: "Cork" };
    expect(deliveriesHref(current, { view: "waiting" })).toBe("/admin/deliveries?q=Cork");
    expect(deliveriesHref({}, { view: "closed", limit: "50", sort: "newest" })).toBe(
      "/admin/deliveries?view=closed",
    );
  });

  it("opens and closes a lot's panel without losing the list's state", () => {
    expect(deliveryPanelHref({ view: "quoted" }, LOT)).toBe(
      `/admin/deliveries?view=quoted&record=${LOT}`,
    );
    expect(deliveryPanelHref({ view: "quoted", record: LOT }, null)).toBe(
      "/admin/deliveries?view=quoted",
    );
  });

  it("gives every tab its count and address", () => {
    const tabs = deliveryTabs(
      { q: "Cork" },
      {
        waiting: 3,
        quoted: 1,
        to_dispatch: 0,
        on_the_way: 2,
        delivered: 5,
        closed: 1,
      },
    );
    expect(tabs.map((tab) => [tab.label, tab.count])).toEqual([
      ["Waiting for a price", 3],
      ["Quoted", 1],
      ["To dispatch", 0],
      ["On the way", 2],
      ["Delivered", 5],
      ["Closed", 1],
    ]);
    expect(tabs[0]?.href).toBe("/admin/deliveries?q=Cork");
    expect(tabs[3]?.href).toBe("/admin/deliveries?q=Cork&view=on_the_way");
  });

  it("leaves the counts out when they did not load, rather than showing zeros", () => {
    expect(deliveryTabs({}, null).every((tab) => tab.count === undefined)).toBe(true);
  });

  it("pages forward and back only when there is more than one page", () => {
    expect(deliveriesPagination({}, { offset: 0, limit: 50, total: 3, itemCount: 3 })).toBeNull();
    expect(deliveriesPagination({}, { offset: 0, limit: 50, total: 120, itemCount: 50 })).toEqual({
      summary: "1–50 of 120 deliveries",
      prevHref: null,
      nextHref: "/admin/deliveries?offset=50",
    });
    expect(
      deliveriesPagination(
        { offset: "100" },
        { offset: 100, limit: 50, total: 120, itemCount: 20 },
      ),
    ).toEqual({
      summary: "101–120 of 120 deliveries",
      prevHref: "/admin/deliveries?offset=50",
      nextHref: null,
    });
  });

  it("names the sale on its chip, and the chip clears only the sale", () => {
    const filters = parseDeliveriesSearch({ sale: SALE, q: "Cork" });
    expect(
      deliveriesFilterChips(filters, { sale: SALE, q: "Cork" }, [
        { id: SALE, title: "Modern British" },
      ]),
    ).toEqual([
      { id: "sale", label: "Sale: Modern British", clearHref: "/admin/deliveries?q=Cork" },
    ]);
    expect(deliveriesFilterChips(parseDeliveriesSearch({}), {}, [])).toEqual([]);
  });
});

describe("badges", () => {
  it("says every status in words and shape, never by colour alone", () => {
    expect(deliveryBadge("waiting")).toEqual({
      label: "Waiting for a price",
      tone: "warning",
      shape: "dot",
    });
    expect(deliveryBadge("quoted")).toEqual({ label: "Quote sent", tone: "info", shape: "dot" });
    expect(deliveryBadge("delivered")).toEqual({
      label: "Delivered",
      tone: "success",
      shape: "check",
    });
    expect(deliveryBadge("withdrawn")).toEqual({
      label: "Withdrawn by buyer",
      tone: "neutral",
      shape: "ring",
    });
  });

  it("names why a delivery closed", () => {
    expect(
      deliveryBadges({ status: "closed", closedReason: "cancelled", awaitingPayment: false }),
    ).toEqual([{ label: "Cancelled", tone: "neutral", shape: "ring" }]);
  });

  it("adds Awaiting payment beside an unpaid booking, and never more than two", () => {
    expect(deliveryBadges(BOOKED_UNPAID).map((badge) => badge.label)).toEqual([
      "Booked, not dispatched",
      "Awaiting payment",
    ]);
  });
});

describe("cells", () => {
  it("titles the row by lot number and title, with the sale and its close under it", () => {
    expect(deliveryLotTitle(deliveryFixture().lot)).toBe("Lot 42 · Harbour at dusk");
    expect(deliveryLotTitle({ title: "Untitled", lotNumber: null })).toBe("Untitled");
    expect(deliverySaleLine(deliveryFixture().sale, now)).toBe("Modern British · Thu 12 Nov");
  });

  it("shows no price before a quote, and the price after", () => {
    expect(deliveryPrice(deliveryFixture())).toBeNull();
    expect(deliveryPrice(BOOKED_UNPAID)).toBe("£180.00");
  });

  it("says how long a delivery has waited where it is, or who has it on the way", () => {
    expect(deliverySince(deliveryFixture(), now)).toBe("Asked 2 days ago");
    expect(deliverySince(BOOKED_UNPAID, now)).toBe("Accepted 23 hours ago");
    expect(deliverySince(ON_THE_WAY, now)).toBe("Example Couriers · EX123456789GB");
    expect(
      deliverySince(
        deliveryFixture({
          status: "closed",
          closedReason: "withdrawn",
          statusSince: "2026-11-16T09:00:00.000Z",
        }),
        now,
      ),
    ).toBe("Withdrawn 3 hours ago");
  });

  it("gives a phone row one meta line: buyer, destination and price once quoted", () => {
    expect(deliveryPhoneMeta(deliveryFixture())).toBe(
      "Example Trading Ltd · 12 Rue Exemple, 69002 Lyon, France",
    );
    expect(deliveryPhoneMeta(BOOKED_UNPAID)).toBe(
      "Example Trading Ltd · 12 Rue Exemple, 69002 Lyon, France · £180.00",
    );
  });

  it("says whether the lot is paid", () => {
    expect(deliveryPaidLine(deliveryFixture(), now)).toBe("Not yet");
    expect(deliveryPaidLine(ON_THE_WAY, now)).toBe("Yes, Sun 15 Nov");
  });
});

describe("deliveryTimeline", () => {
  it("tells the story newest first, with the price and who took each step", () => {
    expect(deliveryTimeline(ON_THE_WAY).map((event) => [event.title, event.actor])).toEqual([
      ["Handed to the courier", "LAX"],
      ["Buyer accepted the quote", "Buyer"],
      ["LAX sent a quote of £180.00", "LAX"],
      ["Buyer asked for a delivery price", "Buyer"],
    ]);
  });

  it("keeps a step with no recorded time in its place, and says the time is not recorded", () => {
    const [latest, ...earlier] = deliveryTimeline(ON_THE_WAY);
    expect(latest).toMatchObject({ title: "Handed to the courier", at: null });
    expect(latest?.noTime).toBe("Time not recorded");
    expect(earlier.every((event) => event.at !== null)).toBe(true);
  });

  it("calls a refunded or cancelled purchase a cancelled purchase, not a cancelled sale", () => {
    expect(deliveryTimeline(REFUNDED)[0]?.title).toBe("Purchase cancelled");
    expect(deliveryTimeline(COLLECTED)[0]).toMatchObject({
      title: "Buyer collected it in person",
      at: "2026-11-16T11:00:00.000Z",
    });
  });
});

describe("no time recorded", () => {
  it("names the step alone in the Waiting column, never a time made from the last edit", () => {
    expect(deliverySince(REFUNDED, now)).toBe("Cancelled");
    expect(deliverySinceExact(REFUNDED, now)).toBe("Time not recorded");
    const delivered = deliveryFixture({ status: "delivered", statusSince: null });
    expect(deliverySince(delivered, now)).toBe("Delivered");
    // On the way with no courier on record: the step, with no time.
    expect(deliverySince({ ...ON_THE_WAY, fulfilment: null }, now)).toBe("Dispatched");
  });

  it("closes a lot collected in person with its own badge and time", () => {
    expect(deliveryBadges(COLLECTED)).toEqual([
      { label: "Collected in person", tone: "neutral", shape: "ring" },
    ]);
    expect(deliverySince(COLLECTED, now)).toBe("Collected 1 hour ago");
  });
});

describe("copy", () => {
  it("takes every label from the copy file", () => {
    for (const key of Object.keys(DELIVERIES_COPY.badges) as Array<
      keyof typeof DELIVERIES_COPY.badges
    >) {
      expect(deliveryBadge(key).label).toBe(DELIVERIES_COPY.badges[key]);
    }
    expect(paddleLine(deliveryFixture().buyer)).toBe(DELIVERIES_COPY.paddle(118));
    expect(deliveryBuyerLine(deliveryFixture().buyer)).toBe("Example Trading Ltd · Paddle 118");
    expect(deliveriesRangeSummary({ offset: 0, itemCount: 1, total: 1 })).toBe("1–1 of 1 delivery");
    expect(deliveriesRangeSummary({ offset: 50, itemCount: 50, total: 312 })).toBe(
      "51–100 of 312 deliveries",
    );
  });

  it("says the Waiting for a price count as waiting, on that tab only", () => {
    const tabs = deliveryTabs(
      {},
      { waiting: 3, quoted: 1, to_dispatch: 0, on_the_way: 0, delivered: 0, closed: 0 },
    );
    expect(tabs.find((tab) => tab.id === "waiting")?.countLabel).toBe("waiting");
    expect(tabs.filter((tab) => tab.countLabel)).toHaveLength(1);
    expect(deliveryTabs({}, null).some((tab) => tab.countLabel)).toBe(false);
  });
});
