import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingStatusMotif, MarketingStatusState } from "./marketing-status-state.js";

describe("MarketingStatusMotif", () => {
  it("draws the magnifier for the search-remove alias", () => {
    const { container } = render(<MarketingStatusMotif motif="search-remove" />);
    const motif = screen.getByTestId("marketing-status-motif-search-remove");
    expect(motif).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector('svg[data-illustration="search"]')).not.toBeNull();
  });

  it("draws the empty frame for gallery and the parcel for bag, never a labelled plate", () => {
    const { container } = render(
      <>
        <MarketingStatusMotif motif="gallery" />
        <MarketingStatusMotif motif="bag" />
      </>,
    );
    expect(container.querySelector('svg[data-illustration="frame"]')).not.toBeNull();
    expect(container.querySelector('svg[data-illustration="parcel"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Gallery");
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

  it("swaps the empty frame for the askew frame on errors", () => {
    const { container } = render(
      <MarketingStatusState variant="error" title="We couldn’t load this" layout="page" />,
    );
    expect(container.querySelector('svg[data-illustration="askew"]')).not.toBeNull();
  });
});
