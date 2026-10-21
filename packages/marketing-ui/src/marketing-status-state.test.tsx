import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingStatusMotif, MarketingStatusState } from "./marketing-status-state.js";

describe("MarketingStatusMotif", () => {
  it("draws the search-remove glyph on the hatched plate", () => {
    const { container } = render(<MarketingStatusMotif motif="search-remove" />);
    const motif = screen.getByTestId("marketing-status-motif-search-remove");
    expect(motif).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".marketing-status-state__motif-glyph svg")).not.toBeNull();
  });
});

describe("MarketingStatusState", () => {
  it("renders a no-results state with the search-remove motif", () => {
    render(
      <MarketingStatusState
        motif="search-remove"
        title="No available items"
        description="Try a different spelling."
      />,
    );
    expect(screen.getByRole("heading", { name: "No available items" })).toBeInTheDocument();
    expect(screen.getByTestId("marketing-status-motif-search-remove")).toBeInTheDocument();
  });
});
