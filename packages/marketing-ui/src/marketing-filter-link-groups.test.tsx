import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingFilterLinkGroups } from "./marketing-filter-link-groups.js";

describe("MarketingFilterLinkGroups", () => {
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

  it("draws each option as a plain anchor to its address, so it works without JavaScript", () => {
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
    const row = screen.getByRole("checkbox", { name: "Brands , 4" });
    expect(row.tagName).toBe("A");
    expect(row).toHaveAttribute("href", "/artists/kind/brands");
    expect(row).toHaveAttribute("aria-checked", "false");
  });

  it("marks an applied option checked, and its address takes it off", () => {
    render(
      <MarketingFilterLinkGroups
        groups={[
          {
            id: "kind",
            title: "Type",
            links: [{ label: "Brands", href: "/artists", count: 4, active: true }],
          },
        ]}
      />,
    );
    const row = screen.getByRole("checkbox", { name: "Brands , 4" });
    expect(row).toHaveAttribute("aria-checked", "true");
    expect(row).toHaveAttribute("href", "/artists");
  });

  it("gives an option with no works no address, but keeps an applied one linked", () => {
    render(
      <MarketingFilterLinkGroups
        groups={[
          {
            id: "kind",
            title: "Type",
            links: [
              { label: "Marques", href: "/artists/kind/marques", count: 0, active: false },
              { label: "Brands", href: "/artists", count: 0, active: true },
            ],
          },
        ]}
      />,
    );
    const empty = screen.getByRole("checkbox", { name: "Marques , 0" });
    expect(empty).not.toHaveAttribute("href");
    expect(empty).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("checkbox", { name: "Brands , 0" })).toHaveAttribute(
      "href",
      "/artists",
    );
  });

  it("shows a choice of one as a group of plain links, the chosen one marked current", () => {
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
    expect(screen.getByRole("group", { name: "Sort by" })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A–Z" })).toHaveAttribute("aria-current", "true");
    const other = screen.getByRole("link", { name: "Most lots" });
    expect(other.tagName).toBe("A");
    expect(other).toHaveAttribute("href", "/artists?sort=popular");
  });
});
