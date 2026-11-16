import { SalesFilterSidebar } from "@/components/sections/sales/sales-filter-sidebar";
import type { SalesFacetCounts } from "@/lib/marketing/sales-calendar-facets";
import { calendarSalesHrefFromState } from "@/lib/marketing/sales-calendar-params";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    scroll: _scroll,
    ...rest
  }: { href: string; children: React.ReactNode; scroll?: boolean }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const state = {
  tab: "upcoming" as const,
  deliveryMode: "online" as const,
  location: "all" as const,
  sort: "startAsc" as const,
  view: "grid" as const,
};

const facets: SalesFacetCounts = {
  delivery: { online: 4, onsite: 0 },
  location: { online: 3, london: 2 },
  months: { 11: 3 },
  years: { 2026: 4 },
  departments: { "cat-1": 2 },
};

function rail() {
  return (
    <SalesFilterSidebar
      state={state}
      resultCount={4}
      categories={[
        { id: "cat-1", name: "Modern Art" },
        { id: "cat-2", name: "Ceramics" },
      ]}
      years={[2026]}
      facets={facets}
      showResultCount={false}
    />
  );
}

function renderRail() {
  render(rail());
}

describe("SalesFilterSidebar", () => {
  it("reads each option with its count, and the applied one is checked", () => {
    renderRail();
    expect(screen.getByRole("checkbox", { name: "Online, 4" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "London, 2" })).not.toBeChecked();
  });

  it("disables an option that would give no sales", () => {
    renderRail();
    expect(screen.getByRole("checkbox", { name: "In-person, 0" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("takes an applied option off by linking to the address without it", () => {
    renderRail();
    expect(screen.getByRole("checkbox", { name: "Online, 4" })).toHaveAttribute(
      "href",
      "/sales?tab=upcoming",
    );
  });

  it("puts a real <a href> in the server HTML for every option with results, open or collapsed", () => {
    const html = renderToStaticMarkup(rail());
    const doc = new DOMParser().parseFromString(html, "text/html");
    const href = (patch: Parameters<typeof calendarSalesHrefFromState>[1]) =>
      calendarSalesHrefFromState(state, { ...patch, page: undefined });
    const links = (selector: string) =>
      [...doc.querySelectorAll(selector)].map((a) => [
        a.getAttribute("aria-label") ?? a.textContent,
        a.tagName === "A" ? a.getAttribute("href") : null,
      ]);
    // Each group in order: Auction type, Location (open); Department, Month, Year (collapsed).
    expect(links('[role="checkbox"]:not([aria-disabled="true"])')).toEqual([
      ["Online, 4", href({ deliveryMode: "all" })],
      ["Online, 3", href({ location: "online" })],
      ["London, 2", href({ location: "london" })],
      ["Modern Art, 2", href({ categoryId: "cat-1" })],
      ["November, 3", href({ month: 11 })],
      ["2026, 4", href({ year: 2026 })],
    ]);
    // Only options with no sales are left without an address: In-person, Ceramics, 11 months.
    expect(doc.querySelectorAll('[role="checkbox"][aria-disabled="true"]')).toHaveLength(13);
    expect(doc.querySelectorAll('span[role="checkbox"]')).toHaveLength(13);
    // Sort is a link per choice too, not a button.
    expect(links('fieldset a[href]:not([role="checkbox"])')).toEqual([
      ["Start date (soonest first)", href({ sort: "startAsc" })],
      ["Newly listed", href({ sort: "createdDesc" })],
    ]);
  });

  it("keeps a collapsed group's links hidden from view and the accessibility tree", () => {
    renderRail();
    expect(screen.queryByRole("checkbox", { name: "Modern Art, 2" })).toBeNull();
    expect(
      screen.getByRole("checkbox", { name: "Modern Art, 2", hidden: true }).closest("[hidden]"),
    ).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: "London, 2" }).closest("[hidden]")).toBeNull();
  });

  it("groups the sort choices under a legend, not a navigation landmark", () => {
    renderRail();
    expect(screen.queryByRole("navigation")).toBeNull();
    const group = screen.getByRole("group", { name: "Sort by date" });
    expect(group.tagName).toBe("FIELDSET");
    expect(screen.getByRole("link", { name: "Start date (soonest first)" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("shows no counts when they could not be made", () => {
    render(
      <SalesFilterSidebar
        state={state}
        resultCount={4}
        categories={[]}
        years={[2026]}
        facets={null}
        showResultCount={false}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "In-person" })).toHaveAttribute("href");
  });
});
