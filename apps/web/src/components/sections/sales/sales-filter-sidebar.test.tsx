import { SalesFilterSidebar } from "@/components/sections/sales/sales-filter-sidebar";
import type { SalesFacetCounts } from "@/lib/marketing/sales-calendar-facets";
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
  useLinkStatus: () => ({ pending: false }),
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
    expect(screen.getByRole("checkbox", { name: "Online , 4" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "London , 2" })).not.toBeChecked();
  });

  it("disables an option that would give no sales", () => {
    renderRail();
    expect(screen.getByRole("checkbox", { name: "In-person , 0" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("takes an applied option off by linking to the address without it", () => {
    renderRail();
    expect(screen.getByRole("checkbox", { name: "Online , 4" })).toHaveAttribute(
      "href",
      "/sales?tab=upcoming",
    );
  });

  it("renders every option that has results as a real <a href> in the server HTML", () => {
    const html = renderToStaticMarkup(rail());
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rows = [...doc.querySelectorAll('[role="checkbox"]')];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const available = row.getAttribute("aria-disabled") !== "true";
      if (available) {
        expect(row.tagName, row.textContent ?? "").toBe("A");
        expect(row.getAttribute("href"), row.textContent ?? "").toMatch(/^\/sales/);
      }
    }
    // Sort is a link per choice too, not a button.
    expect(doc.querySelectorAll('nav[aria-label="Sort by date"] a[href]')).toHaveLength(2);
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
