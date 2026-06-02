import type { Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { calendarDeliveryLabel } from "./marketing/sales-calendar-params";
import { saleMarketingLocationLabel } from "./sale-location-label";
import {
  getOnlineCloseStepDescription,
  getOnsiteNoWebBiddingNote,
  getSaleDeliveryModeLabel,
  getSaleTypePresentation,
} from "./sale-type-presentation";

describe("sale-type-presentation helper", () => {
  it("resolves correct metadata for raw 'online' string", () => {
    const pres = getSaleTypePresentation("online");
    expect(pres.key).toBe("online");
    expect(pres.label).toBe("Online");
    expect(pres.title).toBe("Online Auction");
    expect(pres.iconName).toBe("Laptop");
    expect(pres.howToTakePart).toHaveLength(3);
  });

  it("resolves correct metadata for raw 'onsite' string", () => {
    const pres = getSaleTypePresentation("onsite");
    expect(pres.key).toBe("onsite");
    expect(pres.label).toBe("In-person");
    expect(pres.title).toBe("In-person Auction");
    expect(pres.iconName).toBe("MapPin");
    expect(pres.howToTakePart).toHaveLength(4);
  });

  it("resolves correct metadata when passed a Sale object", () => {
    const mockSale = {
      id: "s-123",
      title: "Luxury Watch Sale",
      deliveryMode: "online" as const,
    } as unknown as Sale;

    const pres = getSaleTypePresentation(mockSale);
    expect(pres.key).toBe("online");
    expect(pres.label).toBe("Online");
  });

  it("gracefully falls back to onsite on undefined or null input", () => {
    const presNull = getSaleTypePresentation(null);
    expect(presNull.key).toBe("onsite");
    expect(presNull.label).toBe("In-person");

    const presUndefined = getSaleTypePresentation(undefined);
    expect(presUndefined.key).toBe("onsite");
    expect(presUndefined.label).toBe("In-person");
  });

  it("uses accurate anti-sniping copy for online format", () => {
    const pres = getSaleTypePresentation("online");
    const closeStep = pres.howToTakePart.find((s) => s.title === "Timed Lot Close");

    expect(pres.description).toContain("30 seconds");
    expect(pres.description).toContain("final 2 minutes");
    expect(pres.description).not.toMatch(/extends.*by 2 minutes/i);
    expect(pres.description).toContain("often staggered in catalogue order");
    expect(pres.description).not.toContain("sequentially one-by-one");

    expect(closeStep?.description).toContain("30 seconds");
    expect(closeStep?.description).toContain("often staggered in catalogue order");
  });

  it("uses request language and conditional stream copy for onsite format", () => {
    const pres = getSaleTypePresentation("onsite");
    const absentee = pres.howToTakePart.find((s) => s.title === "Submit Absentee Bid");
    const phone = pres.howToTakePart.find((s) => s.title === "Request a Phone Line");
    const stream = pres.howToTakePart.find((s) => s.title === "Watch the Broadcast");

    expect(pres.description).toContain("listed venue");
    expect(pres.description).not.toContain("premier gallery");

    expect(absentee?.description).toContain("request");
    expect(phone?.description).toContain("request");
    expect(stream?.description).toMatch(/When a live stream is available/i);
  });

  it("getOnlineCloseStepDescription appends sale end date when provided", () => {
    const text = getOnlineCloseStepDescription(new Date("2026-06-15T12:00:00Z"));
    expect(text).toContain("30 seconds");
    expect(text).toContain("catalogue closes on");
  });

  it("getOnsiteNoWebBiddingNote states no web bidding", () => {
    expect(getOnsiteNoWebBiddingNote()).toContain("not through the website");
  });

  it("getSaleDeliveryModeLabel matches presentation labels", () => {
    expect(getSaleDeliveryModeLabel("online")).toBe("Online");
    expect(getSaleDeliveryModeLabel("onsite")).toBe("In-person");
  });

  it("calendar and location labels stay in sync for online sales", () => {
    const mockSale = {
      id: "s-1",
      deliveryMode: "online" as const,
    } as unknown as Sale;

    expect(saleMarketingLocationLabel(mockSale)).toBe(getSaleDeliveryModeLabel("online"));
    expect(calendarDeliveryLabel("online")).toBe(getSaleDeliveryModeLabel("online"));
  });
});
