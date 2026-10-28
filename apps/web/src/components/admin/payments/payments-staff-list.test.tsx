import type { PaymentsStaffRow } from "@/lib/admin/finance/payments-staff-list.vm";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaymentsStaffList, type PaymentsStaffListProps } from "./payments-staff-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/payments",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/exports/export-jobs-provider", () => ({
  useExportJobs: () => ({ startExport: vi.fn(), jobs: [] }),
}));

const row: PaymentsStaffRow = {
  id: "pay_1",
  lotId: "lot_1",
  lotTitle: "Golden Hour",
  lotContext: "Lot 12 · Autumn sale",
  buyerId: "user_1",
  buyer: "Ada Lovelace",
  sellerId: "seller_1",
  amount: "£4,140.00",
  amountPence: 414_000,
  platformFee: "£414.00",
  status: "captured",
  statusPresentation: { label: "Captured", tone: "success" },
  fulfilment: null,
  createdAt: "2026-10-20T10:00:00.000Z",
  xero: { invoiceNumber: null, invoiceUrl: null, syncStatus: null, lastError: null },
  canCapture: false,
  canRefund: true,
};

function renderList(access: { canOpenLot: boolean; canOpenClient: boolean }) {
  const props: PaymentsStaffListProps = {
    search: {},
    view: "all",
    rows: [row],
    summary: { totalVolume: 4140, captured: 4140, pending: 0, refunded: 0 },
    attentionCounts: { manualReviewCount: 0, disputesOpen: 0 },
    canWritePayments: true,
    exportFilters: {},
    pageSize: 50,
    pagination: null,
    loadError: null,
    ...access,
  };
  return render(
    <StaffTooltipProvider>
      <PaymentsStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

describe("PaymentsStaffList links", () => {
  it("links the lot and the buyer for someone who can open those pages", () => {
    renderList({ canOpenLot: true, canOpenClient: true });
    expect(screen.getAllByRole("link", { name: "Golden Hour" })[0]).toHaveAttribute(
      "href",
      "/admin/lots/lot_1",
    );
    expect(screen.getAllByRole("link", { name: "Ada Lovelace" })[0]).toHaveAttribute(
      "href",
      "/admin/clients/user_1",
    );
  });

  it("shows the lot and the buyer as plain text for a finance-only person", () => {
    renderList({ canOpenLot: false, canOpenClient: false });
    expect(screen.getAllByText("Golden Hour").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Golden Hour" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ada Lovelace" })).not.toBeInTheDocument();
  });
});
