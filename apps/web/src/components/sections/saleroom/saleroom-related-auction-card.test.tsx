import { SaleroomRelatedAuctionCard } from "@/components/sections/saleroom/saleroom-related-auction-card";
import type { RelatedSaleVM } from "@/components/sections/saleroom/view-models";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

const sale: RelatedSaleVM = {
  id: "sale-2",
  href: "/sales/modern/sale-2",
  title: "Modern Prints",
  kindLabel: "Online Auction",
  dateLabel: "12 Jun 2026",
  dateLine: "12 JUN 2026",
  itemsLabel: "24 lots",
  imageUrl: "https://cdn/cover.jpg",
  coverImageAlt: "Modern Prints — auction cover",
  status: "scheduled",
  deliveryMode: "online",
  isLive: false,
  startsSoon: true,
  countdownEndIso: null,
  locationLabel: null,
};

describe("SaleroomRelatedAuctionCard", () => {
  it("uses SaleCard list layout with cta Explore action", () => {
    render(<SaleroomRelatedAuctionCard sale={sale} />);
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute(
      "href",
      "/sales/modern/sale-2",
    );
    expect(screen.getByText("Modern Prints")).toBeInTheDocument();
    expect(screen.getByText("24 lots")).toBeInTheDocument();
  });
});
