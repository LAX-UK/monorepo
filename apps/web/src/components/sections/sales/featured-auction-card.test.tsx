import { FeaturedAuctionCard } from "@/components/sections/sales/featured-auction-card";
import type { FeaturedAuctionCardVM } from "@/components/sections/sales/sales-view-models";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} data-testid="next-image" />,
}));

const vm: FeaturedAuctionCardVM = {
  id: "f1",
  href: "/sales/featured",
  title: "Featured title",
  coverImageUrl: null,
  coverImageAlt: "Featured title",
  auctionTypeLabel: "Online Auction",
  dateLabel: "1 JAN 2026 | 10:00 AM GMT",
  locationLabel: "London",
  status: "scheduled",
};

describe("FeaturedAuctionCard", () => {
  it("wraps card in a single link to href", () => {
    render(<FeaturedAuctionCard vm={vm} />);
    const link = screen.getByRole("link", { name: /featured title/i });
    expect(link).toHaveAttribute("href", "/sales/featured");
  });

  it("renders date and location", () => {
    render(<FeaturedAuctionCard vm={vm} />);
    expect(screen.getByText(/1 JAN 2026/i)).toBeInTheDocument();
    expect(screen.getByText("London")).toBeInTheDocument();
  });

  it("avoids hex arbitrary color classes on the card link", () => {
    const { container } = render(<FeaturedAuctionCard vm={vm} />);
    const link = container.querySelector("a.rounded-lg");
    expect(link?.className ?? "").not.toMatch(/\[#[0-9a-fA-F]{3,8}\]/);
  });
});
