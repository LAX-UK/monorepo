import type { ManualReviewStaffRow } from "@/lib/admin/finance/payments-staff-list.vm";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManualReviewStaffList, type ManualReviewStaffListProps } from "./manual-review-staff-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/payments",
  useSearchParams: () => new URLSearchParams(),
}));

const row: ManualReviewStaffRow = {
  id: "pay_1",
  lotId: "lot_1",
  lotTitle: "Golden Hour",
  lotNumber: 12,
  winnerId: "user_1",
  winner: "ada@example.test",
  seller: "Gallery One",
  amount: "£4,140.00",
  reason: "High value",
  compliance: false,
  source: {
    amount: "4140.00",
    createdAt: "2026-10-20T10:00:00.000Z",
  } as ManualReviewStaffRow["source"],
};

function renderList(access: { canOpenLot: boolean; canOpenClient: boolean }) {
  const props: ManualReviewStaffListProps = {
    search: { manualReview: "1" },
    rows: [row],
    queueSize: 1,
    reasonFilter: "",
    summary: { total: 1, financeHolds: 1, complianceHolds: 0 },
    attentionCounts: { manualReviewCount: 1, disputesOpen: 0 },
    canOpenComplianceQueues: false,
    canResolveManualReview: true,
    loadError: null,
    ...access,
  };
  return render(
    <StaffTooltipProvider>
      <ManualReviewStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

describe("ManualReviewStaffList links", () => {
  it("links the lot and the winner for someone who can open those pages", () => {
    renderList({ canOpenLot: true, canOpenClient: true });
    expect(screen.getAllByRole("link", { name: "Golden Hour" })[0]).toHaveAttribute(
      "href",
      "/admin/lots/lot_1",
    );
    expect(screen.getAllByRole("link", { name: "ada@example.test" })[0]).toHaveAttribute(
      "href",
      "/admin/clients/user_1",
    );
  });

  it("shows the lot and the winner as plain text for a finance-only person", () => {
    renderList({ canOpenLot: false, canOpenClient: false });
    expect(screen.getAllByText("Golden Hour").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ada@example.test").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Golden Hour" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ada@example.test" })).not.toBeInTheDocument();
  });
});
