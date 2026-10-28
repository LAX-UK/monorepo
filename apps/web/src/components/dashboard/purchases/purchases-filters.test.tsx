import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PurchasesActiveFilters,
  PurchasesFilters,
  countPurchaseFilters,
} from "./purchases-filters";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/purchases",
  useSearchParams: () => new URLSearchParams("tab=completed"),
}));

describe("PurchasesFilters", () => {
  it("counts only the filters in use", () => {
    expect(countPurchaseFilters({ q: "", payment: "all", year: null })).toBe(0);
    expect(countPurchaseFilters({ q: "ring", payment: "paid", year: 2026 })).toBe(3);
  });

  it("shows one Filters button with its count", () => {
    render(<PurchasesFilters filters={{ q: "", payment: "paid", year: 2026 }} years={[2026]} />);
    expect(screen.getAllByRole("button", { name: "Filters, 2 applied" }).length).toBeGreaterThan(0);
  });

  it("shows the filters in use as chips that keep the view, and nothing when none are", () => {
    const { container, rerender } = render(
      <PurchasesActiveFilters filters={{ q: "", payment: "all", year: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<PurchasesActiveFilters filters={{ q: "", payment: "paid", year: 2026 }} />);
    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((href) => href?.includes("tab=completed"))).toBe(true);
  });

  it("applies the chosen filters together and keeps the view", () => {
    render(
      <PurchasesFilters filters={{ q: "", payment: "all", year: null }} years={[2026, 2025]} />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Filters" })[0] as HTMLElement);
    fireEvent.click(screen.getAllByRole("button", { name: "2025" })[0] as HTMLElement);
    fireEvent.click(screen.getAllByRole("button", { name: /apply|show/i })[0] as HTMLElement);
    expect(replace).toHaveBeenCalledWith("/purchases?year=2025&tab=completed", { scroll: false });
  });
});
