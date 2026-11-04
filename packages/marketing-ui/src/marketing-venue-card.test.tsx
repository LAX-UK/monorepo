import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingVenueCard } from "./marketing-venue-card.js";

describe("MarketingVenueCard", () => {
  it("shows the photograph above the name when it has an image", () => {
    const { container } = render(
      <MarketingVenueCard
        href="/visit/marylebone"
        name="Marylebone"
        addressLines={["156 New Cavendish Street"]}
        image={<span data-testid="photo" />}
      />,
    );
    expect(screen.getByTestId("photo")).toBeInTheDocument();
    expect(container.querySelector("[data-layout]")).not.toHaveClass("border-t");
  });

  it("is text-led without an image, across the width at any layout", () => {
    const { container } = render(
      <MarketingVenueCard
        href="/visit/marylebone"
        name="Marylebone"
        addressLines={["156 New Cavendish Street", "London W1W 6YW"]}
        layout="wide"
      />,
    );
    const card = container.querySelector("[data-layout]");
    expect(card).toHaveClass("border-t");
    expect(card?.className).not.toContain("md:grid-cols-[7fr_5fr]");
    expect(screen.getByRole("link", { name: /Marylebone/ })).toHaveAttribute(
      "href",
      "/visit/marylebone",
    );
    expect(screen.getByText("156 New Cavendish Street")).toBeInTheDocument();
  });
});
