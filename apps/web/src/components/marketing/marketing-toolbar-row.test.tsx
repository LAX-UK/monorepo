import { MarketingToolbarRow } from "@/components/marketing/marketing-toolbar-row";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("MarketingToolbarRow", () => {
  it("hides inline filters below lg when a mobile filter trigger is provided", () => {
    const { container } = render(
      <MarketingToolbarRow
        countLabel="24 lots"
        filters={<div data-testid="filters">Filters</div>}
        mobileFilterTrigger={<button type="button">Filters</button>}
        sort={<div data-testid="sort">Sort</div>}
      />,
    );

    const filterSlot = container.querySelector(".hidden.lg\\:flex");
    expect(filterSlot).not.toBeNull();
    expect(filterSlot?.className).not.toMatch(/md:flex/);
    expect(screen.getByTestId("filters")).toBeInTheDocument();
  });

  it("stacks trailing controls on mobile for catalogue mode", () => {
    render(
      <MarketingToolbarRow
        countLabel="12 lots"
        filters={<div>Filters</div>}
        trailing={<div data-testid="trailing">Trailing</div>}
        mobileFilterTrigger={<button type="button">Filters</button>}
        stackTrailingOnMobile
      />,
    );

    expect(screen.getByTestId("mobile-trailing-row")).toBeInTheDocument();
    expect(screen.getAllByTestId("trailing")).toHaveLength(2);
  });

  it("stacks trailing on home sections only when filters and trailing are both set", () => {
    const { rerender } = render(
      <MarketingToolbarRow
        countLabel="Featured"
        trailing={<div data-testid="trailing">View all</div>}
        stackTrailingOnMobile
        stackTrailingRequiresFilters
      />,
    );

    expect(screen.queryByTestId("mobile-trailing-row")).toBeNull();

    rerender(
      <MarketingToolbarRow
        countLabel="Featured"
        filters={<div>Status</div>}
        trailing={<div data-testid="trailing">View all</div>}
        stackTrailingOnMobile
        stackTrailingRequiresFilters
      />,
    );

    expect(screen.getByTestId("mobile-trailing-row")).toBeInTheDocument();
  });
});
