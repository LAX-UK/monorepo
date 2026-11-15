import { SellDepartmentView } from "@/components/marketing/sell-tailored-landing-page";
import type { DepartmentEvidence } from "@/lib/departments/department-evidence";
import { SELL_FEES_POINTS } from "@/lib/marketing/sell-landing";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const DEPARTMENTS = [
  { path: "/sell/estate", title: "Estates", contactType: "estate" },
  { path: "/sell/corporate", title: "Corporate disposals", contactType: "corporate" },
  {
    path: "/sell/prints",
    title: "Fine prints",
    categorySlug: "fine-prints",
    contactType: "prints",
  },
  { path: "/sell/watches", title: "Watches & clocks", categorySlug: "watches-clocks" },
  { path: "/sell/motor-cars", title: "Motor cars", categorySlug: "motor-cars" },
] as const;

const EVIDENCE = {
  categoryId: "c1",
  soldHref: "/results",
  onSaleHref: "/auctions",
  sold: [],
  onSale: [],
  deadline: { date: "1 December", saleTitle: "Winter Sale" },
} as unknown as DepartmentEvidence;

describe.each(DEPARTMENTS)("SellDepartmentView $path", (department) => {
  const props = {
    ...department,
    breadcrumbLabel: department.title,
    description: "What we look for.",
    lead: "Tell us about it.",
    bullets: ["First thing", "Second thing"],
  } as const;

  it("renders the shared selling template sections with the agreed defaults", () => {
    render(<SellDepartmentView {...props} evidence={null} />);
    expect(screen.getByRole("heading", { level: 1, name: department.title })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How it works" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Fees in plain words" })).toBeTruthy();
    expect(screen.getByText(SELL_FEES_POINTS[0])).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Questions" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "What to prepare" })).toBeTruthy();
    expect(screen.getByText("First thing")).toBeTruthy();
    expect(screen.getAllByText(/usually reply within one working day/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Talk to a specialist" }).length).toBe(2);
    expect(screen.queryByRole("heading", { name: "Our specialists" })).toBeNull();
    expect(screen.queryByText(/email me a link/i)).toBeNull();
    expect(screen.queryByText(/\d+(\.\d+)?\s?%/)).toBeNull();
  });

  it("opens the form with the department chosen", () => {
    render(<SellDepartmentView {...props} evidence={null} />);
    const sell = screen.getAllByRole("link", { name: /sell a work/i });
    expect(sell.length).toBeGreaterThan(0);
    if ("categorySlug" in department) {
      for (const link of sell) expect(link.getAttribute("href")).toContain(department.categorySlug);
    }
  });

  it("shows the next consignment deadline when the department has one", () => {
    render(<SellDepartmentView {...props} departmentNoun="works" evidence={EVIDENCE} />);
    expect(screen.getByText("Consign works by 1 December")).toBeTruthy();
    expect(screen.getByText(/Winter Sale is the next sale/)).toBeTruthy();
  });
});
