import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArtistBadges } from "./artist-badges";

describe("ArtistBadges", () => {
  it("renders neutral status badges with a shape cue, never an accent fill", () => {
    render(<ArtistBadges featured verified kindLabel="Marque" />);

    for (const label of ["Featured", "Verified", "Marque"]) {
      const badge = screen.getByText(label).closest("[data-tone]");
      expect(badge).toHaveAttribute("data-tone", "neutral");
      expect(badge?.querySelector("[data-shape]")).not.toBeNull();
    }
    expect(
      screen.getByText("Verified").closest("[data-tone]")?.querySelector("[data-shape]"),
    ).toHaveAttribute("data-shape", "check");
  });

  it("adds an edge on images only", () => {
    const { rerender } = render(<ArtistBadges verified />);
    expect(screen.getByText("Verified").closest("[data-tone]")?.className).not.toContain("ring-1");
    rerender(<ArtistBadges verified onImage />);
    expect(screen.getByText("Verified").closest("[data-tone]")?.className).toContain("ring-1");
  });

  it("renders nothing for an artist with no badges", () => {
    const { container } = render(<ArtistBadges />);
    expect(container).toBeEmptyDOMElement();
  });
});
