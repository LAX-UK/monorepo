import { VenueMapCard } from "@/components/marketing/venue-map-card";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("VenueMapCard", () => {
  it("renders address and directions link", () => {
    render(
      <VenueMapCard
        locationName="TheLax Saleroom"
        addressLines={["1 Gallery Row", "London", "W1A 2AA"]}
        directionsUrl="https://maps.example.com/dir"
      />,
    );
    expect(screen.getByText("TheLax Saleroom")).toBeInTheDocument();
    expect(screen.getByText("1 Gallery Row")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get directions/i })).toHaveAttribute(
      "href",
      "https://maps.example.com/dir",
    );
  });

  it("reveals map iframe after Show map is clicked", () => {
    render(
      <VenueMapCard
        locationName="Venue"
        addressLines={["London"]}
        embedUrl="https://www.google.com/maps?q=London&output=embed"
        directionsUrl="https://maps.example.com/dir"
      />,
    );
    expect(screen.queryByTitle("Map of Venue")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show map/i }));
    expect(screen.getByTitle("Map of Venue")).toHaveAttribute(
      "src",
      "https://www.google.com/maps?q=London&output=embed",
    );
  });

  it("returns null when no venue content", () => {
    const { container } = render(
      <VenueMapCard locationName={null} addressLines={[]} embedUrl={null} directionsUrl={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
