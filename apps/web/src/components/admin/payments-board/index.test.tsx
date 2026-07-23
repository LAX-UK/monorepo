import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminPaymentsBoard } from "./index";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/payments",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/layout/density-provider", () => ({
  useTableDensity: () => ({ density: "comfortable" as const }),
}));

const row = {
  id: "pay_secret_uuid_12345",
  lotId: "lot_1",
  lotTitle: "Vintage Chronograph",
  buyerId: "buyer_uuid",
  buyerLabel: "Jane Buyer",
  sellerId: "seller_uuid",
  amount: "1200.00",
  amountDisplay: { primary: "£1,200.00" },
  platformFee: "£120.00",
  status: "captured" as const,
  fulfilmentStatus: null,
  xeroInvoiceNumber: null,
  xeroOnlineInvoiceUrl: null,
  xeroSyncStatus: null,
  xeroLastError: null,
};

describe("AdminPaymentsBoard", () => {
  it("does not show payment UUID in table scan path", () => {
    render(<AdminPaymentsBoard rows={[row]} />);
    expect(screen.queryByText(/pay_secret_uuid/)).toBeNull();
    expect(screen.getAllByText("Vintage Chronograph").length).toBeGreaterThan(0);
  });
});
