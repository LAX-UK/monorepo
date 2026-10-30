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

  it("shows the artist's facts under the name", () => {
    render(
      <MarketingArtistSummary
        title="About the artist"
        name="Ada Lane"
        href="/artists/ada-lane"
        meta="British · b. 1984 · Painter"
      />,
    );
    expect(screen.getByText("British · b. 1984 · Painter")).toBeInTheDocument();
  });

  it("falls back to initials without a portrait and omits an empty bio", () => {
    const { container } = render(
      <MarketingArtistSummary title="About the artist" name="Ada Lane" href="/artists/ada-lane" />,
    );
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(container.querySelector("p")).toBeNull();
  });

  it("shows the actions row under the bio, beside the trailing action", () => {
    render(
      <MarketingArtistSummary
        title="About the artist"
        name="Ada Lane"
        href="/artists/ada-lane"
        action={<span>Follow slot</span>}
        actions={
          <>
            <a href="/artists/ada-lane">Editions by Ada Lane (4)</a>
            <a href="https://lax.art/artists/ada-lane">Profile on lax.art</a>
          </>
        }
        bio="Ada Lane paints the Thames."
      />,
    );
    const profile = screen.getByRole("link", { name: "Profile on lax.art" });
    const bio = screen.getByText("Ada Lane paints the Thames.");
    expect(screen.getByText("Follow slot")).toBeInTheDocument();
    expect(bio.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders no actions row when none is given", () => {
    const { container } = render(
      <MarketingArtistSummary title="About the artist" name="Ada Lane" href="/artists/ada-lane" />,
    );
    expect(container.querySelector('[data-slot="artist-summary-actions"]')).toBeNull();
  });
});
