import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingArtistSummary } from "./marketing-artist-summary.js";

describe("MarketingArtistSummary", () => {
  it("renders a titled section with the linked name, action and bio", () => {
    render(
      <MarketingArtistSummary
        title="About the artist"
        name="Ada Lane"
        href="/artists/ada-lane"
        action={<span>Follow slot</span>}
        bio="Ada Lane paints the Thames."
      />,
    );
    expect(screen.getByRole("region", { name: "About the artist" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ada Lane" })).toHaveAttribute(
      "href",
      "/artists/ada-lane",
    );
    expect(screen.getByText("Follow slot")).toBeInTheDocument();
    expect(screen.getByText("Ada Lane paints the Thames.")).toBeInTheDocument();
  });

  it("falls back to initials without a portrait and omits an empty bio", () => {
    const { container } = render(
      <MarketingArtistSummary title="About the artist" name="Ada Lane" href="/artists/ada-lane" />,
    );
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(container.querySelector("p")).toBeNull();
  });
});
