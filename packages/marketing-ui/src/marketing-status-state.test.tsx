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
  it("offers an open layout that sits on the page without a box", () => {
    const { container } = render(<MarketingStatusState layout="open" title="No questions yet" />);
    expect(container.firstElementChild).toHaveClass("marketing-status-state--open");
    expect(container.firstElementChild).not.toHaveClass("marketing-status-state--inline");
  });

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

  it("places extra content, such as a search field, between the description and the actions", () => {
    const { container } = render(
      <MarketingStatusState
        layout="page"
        title="We can’t find that page"
        description="Search, or start from one of these."
        control={<input aria-label="Search editions and artists" />}
        actions={<a href="/artworks">Browse editions</a>}
      />,
    );
    const order = [...container.querySelectorAll(".marketing-status-state > *")].map(
      (node) => node.className,
    );
    expect(order.slice(-3)).toEqual([
      "marketing-status-state__description",
      "marketing-status-state__control",
      "marketing-status-state__actions",
    ]);
    expect(screen.getByRole("textbox", { name: "Search editions and artists" })).toBeVisible();
  });
});
