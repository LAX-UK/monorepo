/** @vitest-environment jsdom */
import { ArtworkCatalogueFilterBody } from "@/components/catalogue/artwork-catalogue-filter-body";
import type { CatalogueFilterRailVm } from "@/lib/catalogue/catalogue-filter-groups";
import type { CatalogueSortVm } from "@/lib/catalogue/catalogue-sort";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

const rail = {
  availability: { checked: false, href: "/artworks?available=1" },
  groups: [
    {
      key: "artist",
      title: "Artist",
      options: [
        {
          value: "mara",
          label: "Mara Ellison",
          count: 12,
          active: false,
          href: "/artworks?artist=mara",
        },
        { value: "flora", label: "Flora Powers", count: 3, active: true, href: "/artworks" },
        {
          value: "none",
          label: "Nobody Yet",
          count: 0,
          active: false,
          href: "/artworks?artist=none",
        },
        { value: "late", label: "Late Arrival", count: 0, active: true, href: "/artworks" },
      ],
    },
  ],
} as unknown as CatalogueFilterRailVm;

const sort = {
  current: { value: "newest", label: "Newest", href: "/artworks" },
  options: [
    { value: "newest", label: "Newest", href: "/artworks" },
    { value: "price_asc", label: "Price low to high", href: "/artworks?sort=price_asc" },
  ],
} as unknown as CatalogueSortVm;

function renderRail(props: Partial<Parameters<typeof ArtworkCatalogueFilterBody>[0]> = {}) {
  return render(<ArtworkCatalogueFilterBody rail={rail} onNavigate={vi.fn()} {...props} />);
}

describe("ArtworkCatalogueFilterBody", () => {
  afterEach(cleanup);

  it("draws each option as a checkbox row that is a real link to the filtered address", () => {
    renderRail();
    const group = screen.getByRole("group", { name: "Artist" });
    const mara = within(group).getByRole("checkbox", { name: /^Mara Ellison\s*,\s*12$/ });
    expect(mara.tagName).toBe("A");
    expect(mara.getAttribute("href")).toBe("/artworks?artist=mara");
    expect(mara.getAttribute("aria-checked")).toBe("false");
  });

  it("shows an applied option as checked, and choosing it takes it off", () => {
    renderRail();
    const flora = screen.getByRole("checkbox", { name: /^Flora Powers\s*,\s*3$/ });
    expect(flora.getAttribute("aria-checked")).toBe("true");
    expect(flora.getAttribute("href")).toBe("/artworks");
  });

  it("dims an option that would give nothing and gives it no address, unless it is applied", () => {
    renderRail();
    const empty = screen.getByRole("checkbox", { name: /^Nobody Yet\s*,\s*0$/ });
    expect(empty.getAttribute("aria-disabled")).toBe("true");
    expect(empty.hasAttribute("href")).toBe(false);
    // An applied filter that now gives nothing can still be taken off.
    const applied = screen.getByRole("checkbox", { name: /^Late Arrival\s*,\s*0$/ });
    expect(applied.getAttribute("aria-checked")).toBe("true");
    expect(applied.getAttribute("href")).toBe("/artworks");
  });

  it("keeps the Available only switch above the groups", () => {
    renderRail();
    expect(screen.getByRole("switch", { name: "Available only" })).toBeTruthy();
  });

  it("offers sort as radios in the phone sheet, and the chosen one cannot be taken off", () => {
    renderRail({ sort });
    const group = screen.getByRole("radiogroup", { name: "Sort" });
    const newest = within(group).getByRole("radio", { name: "Newest" });
    expect(newest.getAttribute("aria-checked")).toBe("true");
    expect(newest.getAttribute("href")).toBe("/artworks");
    expect(
      within(group).getByRole("radio", { name: "Price low to high" }).getAttribute("href"),
    ).toBe("/artworks?sort=price_asc");
  });

  it("leaves out the sort group where sort sits above the results", () => {
    renderRail();
    expect(screen.queryByRole("radiogroup", { name: "Sort" })).toBeNull();
  });
});
