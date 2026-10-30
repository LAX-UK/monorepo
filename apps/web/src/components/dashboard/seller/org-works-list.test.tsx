import type { OrgWorkRow } from "@/app/(client)/collection/org-works.vm";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrgWorksList } from "./org-works-list";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/use-dashboard-list-density", () => ({
  useDashboardListRowPaddingClass: () => "",
}));

const row: OrgWorkRow = {
  lotId: "lot-1",
  title: "Harbour at dusk",
  lotNumberLabel: "Lot 12",
  endedAtLabel: "14 Sep 2026",
  endedAtIso: "2026-09-14T16:30:00.000Z",
  imageUrl: null,
  hammerPriceLabel: "£4,200.00",
  href: "/lot/harbour-at-dusk/lot-1",
};

describe("OrgWorksList", () => {
  it("shows the work, its lot number and when it was won", () => {
    render(<OrgWorksList rows={[row]} />);
    expect(screen.getByRole("link", { name: "Harbour at dusk" })).toHaveAttribute(
      "href",
      "/lot/harbour-at-dusk/lot-1",
    );
    expect(screen.getByText(/Lot 12/)).toBeInTheDocument();
    expect(screen.getByText("14 Sep 2026")).toHaveAttribute("datetime", row.endedAtIso);
  });

  it("shows the price to roles that may see money", () => {
    render(<OrgWorksList rows={[row]} />);
    expect(screen.getByText("£4,200.00")).toBeInTheDocument();
  });

  it("leaves the price out for roles that may not, such as a viewer", () => {
    render(<OrgWorksList rows={[{ ...row, hammerPriceLabel: null }]} />);
    expect(screen.getByRole("link", { name: "Harbour at dusk" })).toBeInTheDocument();
    expect(screen.queryByText(/£/)).toBeNull();
  });
});
