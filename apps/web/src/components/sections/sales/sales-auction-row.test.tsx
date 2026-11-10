// The device is in London: a visitor elsewhere has chosen their zone.
process.env.TZ = "Europe/London";

import { SalesAuctionRow } from "@/components/sections/sales/sales-auction-row";
import type { SaleAuctionRowVM } from "@/components/sections/sales/sales-view-models";
import { renderAsVisitorIn, setViewerZone } from "@/test/viewer-zone";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

function baseVm(over: Partial<SaleAuctionRowVM> = {}): SaleAuctionRowVM {
  return {
    id: "s1",
    href: "/sales/test-sale",
    lotsHref: "/sales/test-sale/lots",
    title: "Test sale",
    coverImageUrl: "https://example.com/cover.jpg",
    coverImageAlt: "Test sale",
    scheduleLead: "Online Auction ",
    scheduleRest: "| 1 Jan 2026",
    auctionTypeLine: "ONLINE AUCTION",
    itemsLabel: "3 lots",
    status: "scheduled",
    showRegisterButton: false,
    ...over,
  };
}

describe("SalesAuctionRow", () => {
  it("links title and view lots to the correct hrefs", () => {
    render(<SalesAuctionRow vm={baseVm()} />);
    expect(screen.getByRole("link", { name: "Test sale" })).toHaveAttribute(
      "href",
      "/sales/test-sale",
    );
    expect(screen.getByRole("link", { name: /view images for test sale/i })).toHaveAttribute(
      "href",
      "/sales/test-sale",
    );
    expect(screen.getByRole("link", { name: /view lots/i })).toHaveAttribute(
      "href",
      "/sales/test-sale/lots",
    );
  });

  it("shows register when showRegisterButton is true", () => {
    render(<SalesAuctionRow vm={baseVm({ showRegisterButton: true })} />);
    expect(screen.getByRole("link", { name: /register to bid/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("hides register when showRegisterButton is false", () => {
    render(<SalesAuctionRow vm={baseVm({ showRegisterButton: false })} />);
    expect(screen.queryByRole("link", { name: /register to bid/i })).not.toBeInTheDocument();
  });

  it("uses card shell padding classes", () => {
    const { container } = render(<SalesAuctionRow vm={baseVm()} />);
    const shell = container.querySelector(".rounded-lg.bg-page-bg");
    expect(shell).toBeTruthy();
  });

  it("does not embed arbitrary hex color classes in card chrome", () => {
    const { container } = render(<SalesAuctionRow vm={baseVm()} />);
    const shell = container.querySelector(".rounded-lg.bg-page-bg");
    expect(shell?.className ?? "").not.toMatch(/\[#[0-9a-fA-F]{3,8}\]/);
  });

  describe("the visitor's own time", () => {
    const start = { iso: "2026-11-16T10:00:00.000Z", zone: "Europe/London" };
    const vm = (over: Partial<SaleAuctionRowVM> = {}) =>
      baseVm({ deliveryMode: "hybrid", scheduleRest: "· 16 Nov 2026 · 10:00 GMT", start, ...over });
    afterEach(() => setViewerZone(null));

    it("adds plain text after the schedule for a visitor on another clock", () => {
      renderAsVisitorIn("Africa/Cairo", <SalesAuctionRow vm={vm()} />);
      expect(screen.getByText("10:00 GMT")).toBeInTheDocument();
      expect(screen.getByText("12:00")).toBeInTheDocument();
      expect(screen.getByText(/Your time:/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /show details/i })).toBeNull();
    });

    it("names the next day for a visitor ahead of London", () => {
      renderAsVisitorIn(
        "Australia/Sydney",
        <SalesAuctionRow
          vm={vm({
            scheduleRest: "· 16 Nov 2026 · 16:00 GMT",
            start: { iso: "2026-11-16T16:00:00.000Z", zone: "Europe/London" },
          })}
        />,
      );
      expect(screen.getByText("Tue 17 Nov")).toBeInTheDocument();
    });

    it.each(["Europe/London", "UTC", null])("adds nothing for %s", (zone) => {
      const { container } = renderAsVisitorIn(zone, <SalesAuctionRow vm={vm()} />);
      expect(container.querySelector("time")).toBeNull();
      expect(screen.queryByText(/Your time:/)).toBeNull();
    });
  });
});
