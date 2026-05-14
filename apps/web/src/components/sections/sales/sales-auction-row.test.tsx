import { SalesAuctionRow } from "@/components/sections/sales/sales-auction-row";
import type { SaleAuctionRowVM } from "@/components/sections/sales/sales-view-models";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
    itemsLabel: "3 Items",
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
});
