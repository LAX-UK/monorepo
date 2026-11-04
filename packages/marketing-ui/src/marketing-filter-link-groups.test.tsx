import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketingFilterLinkGroups } from "./marketing-filter-link-groups.js";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("MarketingFilterLinkGroups", () => {
  beforeEach(() => push.mockClear());

  it("titles each group with a level 2 heading so the outline never skips a level", () => {
    render(
      <MarketingFilterLinkGroups
        groups={[
          {
            id: "medium",
            title: "Medium",
            links: [{ label: "Oil", href: "/?medium=oil", active: false }],
          },
          { id: "empty", title: "Empty group", links: [] },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Medium" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Empty group" })).not.toBeInTheDocument();
  });

  it("shows each option as a checkbox with its count, checked when applied", () => {
    render(
      <MarketingFilterLinkGroups
        groups={[
          {
            id: "kind",
            title: "Type",
            links: [
              { label: "Brands", href: "/artists/kind/brands", count: 4, active: true },
              { label: "Marques", href: "/artists/kind/marques", count: 0, active: false },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Brands , 4" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Marques , 0" })).toBeDisabled();
  });

  it("opens the option's address when it is chosen", () => {
    render(
      <MarketingFilterLinkGroups
        groups={[
          {
            id: "kind",
            title: "Type",
            links: [{ label: "Brands", href: "/artists/kind/brands", count: 4, active: false }],
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Brands , 4" }));
    expect(push).toHaveBeenCalledWith("/artists/kind/brands", { scroll: false });
  });

  it("shows a choice of one as radios, and opens the address of the one chosen", () => {
    render(
      <MarketingFilterLinkGroups
        groups={[
          {
            id: "sort",
            title: "Sort by",
            selection: "single",
            links: [
              { label: "A–Z", href: "/artists", active: true },
              { label: "Most lots", href: "/artists?sort=popular", active: false },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole("radio", { name: "A–Z" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Most lots" }));
    expect(push).toHaveBeenCalledWith("/artists?sort=popular", { scroll: false });
  });
});
