import { HomeSectionToolbar } from "@/components/marketing/home-section-toolbar";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("HomeSectionToolbar", () => {
  it("renders count and trailing without sticky positioning", () => {
    const { container } = render(
      <HomeSectionToolbar
        countLabel="6 lots"
        trailing={<span data-testid="view-switcher">View</span>}
      />,
    );

    expect(screen.getByText("6 lots")).toBeInTheDocument();
    expect(screen.getByTestId("view-switcher")).toBeInTheDocument();
    expect(container.querySelector(".sticky")).toBeNull();
  });

  it("stacks trailing on a second mobile row when stackControlsOnMobile is enabled", () => {
    render(
      <HomeSectionToolbar
        countLabel="3 auctions"
        stackControlsOnMobile
        filters={<span data-testid="filters">Filters</span>}
        trailing={<span data-testid="view-switcher">View</span>}
      />,
    );

    const mobileRow = screen.getByTestId("mobile-trailing-row");
    expect(mobileRow).toBeInTheDocument();
    expect(within(mobileRow).getByTestId("view-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("filters")).toBeInTheDocument();
  });

  it("does not stack trailing when filters are absent", () => {
    render(
      <HomeSectionToolbar
        countLabel="3 auctions"
        stackControlsOnMobile
        trailing={<span data-testid="view-switcher">View</span>}
      />,
    );

    expect(screen.queryByTestId("mobile-trailing-row")).not.toBeInTheDocument();
    expect(screen.getByTestId("view-switcher")).toBeInTheDocument();
  });
});
