/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarketingArtistCard } from "./marketing-artist-card.js";
import { MarketingArtistPortraitFill } from "./marketing-artist-portrait-fill.js";

afterEach(cleanup);

describe("artist tile without an image", () => {
  it("shows initials alone on the plain surface, not the hatch, when asked", () => {
    const { container } = render(
      <MarketingArtistCard href="/artists/f" name="Flora Powers" withoutImage="initials" />,
    );
    const initials = screen.getByTestId("marketing-artist-initials");
    expect(initials.textContent).toBe("FP");
    expect(initials.className).toContain("bg-surface-container-low");
    expect(container.querySelector("[data-hatch], [class*='hatch']")).toBeNull();
  });

  it("shows the lead work whole on the paper mat instead of initials", () => {
    const { container } = render(
      <MarketingArtistCard
        href="/artists/f"
        name="Flora Powers"
        withoutImage="initials"
        work={<img alt="" src="/w.jpg" />}
      />,
    );
    expect(screen.queryByTestId("marketing-artist-initials")).toBeNull();
    expect(container.querySelector(".marketing-work-mat img")).not.toBeNull();
  });

  it("keeps the hatched placeholder by default for products that use it", () => {
    render(<MarketingArtistCard href="/artists/f" name="Flora Powers" />);
    expect(screen.queryByTestId("marketing-artist-initials")).toBeNull();
  });

  it("applies the same choice to a portrait frame", () => {
    render(<MarketingArtistPortraitFill name="Flora Powers" withoutImage="initials" />);
    expect(screen.getByTestId("marketing-artist-initials").textContent).toBe("FP");
  });
});
