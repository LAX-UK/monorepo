import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("MarketingListToolbar", () => {
  it("renders sticky shell and hides filters on mobile when mobileFilterTrigger is set", () => {
    const { container } = render(
      <MarketingListToolbar
        countLabel="24 lots"
        mobileFilterTrigger={<button type="button">Filters</button>}
        filters={<span data-testid="desktop-filters">Desktop filters</span>}
        sort={<span>Sort</span>}
      />,
    );

    expect(screen.getByText("24 lots")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByTestId("desktop-filters")).toBeInTheDocument();

    const filterSlot = screen.getByTestId("desktop-filters").parentElement;
    expect(filterSlot?.className).toMatch(/hidden/);
    expect(filterSlot?.className).toMatch(/md:flex/);

    const sticky = container.querySelector(".sticky");
    expect(sticky).not.toBeNull();
  });

  it("keeps filter trigger and trailing on the same row by default", () => {
    render(
      <MarketingListToolbar
        countLabel="24 lots"
        mobileFilterTrigger={<button type="button">Filters</button>}
        trailing={<span data-testid="view-switcher">View</span>}
      />,
    );

    expect(screen.queryByTestId("mobile-trailing-row")).not.toBeInTheDocument();
    expect(screen.getByTestId("view-switcher")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });

  it("can stack trailing on a second mobile row when explicitly enabled", () => {
    render(
      <MarketingListToolbar
        countLabel="24 lots"
        stackTrailingOnMobile
        mobileFilterTrigger={<button type="button">Filters</button>}
        trailing={<span data-testid="view-switcher">View</span>}
      />,
    );

    const mobileRow = screen.getByTestId("mobile-trailing-row");
    expect(mobileRow).toBeInTheDocument();
    expect(within(mobileRow).getByTestId("view-switcher")).toBeInTheDocument();
  });

  it("shows filters on mobile when no mobileFilterTrigger", () => {
    render(<MarketingListToolbar filters={<span data-testid="inline-filters">Inline</span>} />);
    const filterSlot = screen.getByTestId("inline-filters").parentElement;
    expect(filterSlot?.className).toMatch(/\bflex\b/);
    expect(filterSlot?.className).not.toContain("hidden md:flex");
  });
});
