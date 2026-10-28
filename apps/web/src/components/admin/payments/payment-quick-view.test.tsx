import type { PaymentsStaffRow } from "@/lib/admin/finance/payments-staff-list.vm";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaymentQuickView } from "./payment-quick-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

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

function renderPanel(access: { canOpenLot: boolean; canOpenClient: boolean }) {
  return render(
    <StaffTooltipProvider>
      <PaymentQuickView
        row={row}
        canWritePayments
        onClose={vi.fn()}
        onCapture={vi.fn()}
        onRefund={vi.fn()}
        {...access}
      />
    </StaffTooltipProvider>,
  );
}

describe("PaymentQuickView links", () => {
  it("links the lot and the seller for someone who can open those pages", () => {
    renderPanel({ canOpenLot: true, canOpenClient: true });
    expect(screen.getByRole("link", { name: /Open lot/ })).toHaveAttribute(
      "href",
      "/admin/lots/lot_1",
    );
    expect(screen.getByRole("link", { name: "Seller profile" })).toHaveAttribute(
      "href",
      "/admin/clients/seller_1",
    );
  });

  it("shows plain text and no record links for a finance-only person", () => {
    renderPanel({ canOpenLot: false, canOpenClient: false });
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Open lot/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ada Lovelace" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Seller profile" })).not.toBeInTheDocument();
  });
});
