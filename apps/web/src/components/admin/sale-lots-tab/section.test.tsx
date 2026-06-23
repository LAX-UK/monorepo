import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaleLotsTabSection } from "./section";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/actions/admin", () => ({
  adminReturnLotToInventoryResultAction: vi.fn(),
  adminGetLotAttachPreviewAction: vi.fn(),
  adminUpdateLotResultAction: vi.fn(),
}));

vi.mock("@/lib/actions/admin-sales", () => ({
  adminAttachLotToSaleResultAction: vi.fn(),
  adminCancelLotInSaleResultAction: vi.fn(),
  adminDetachLotFromSaleResultAction: vi.fn(),
  adminSetLotStatusResultAction: vi.fn(),
}));

describe("SaleLotsTabSection", () => {
  const baseProps = {
    saleId: "sale-1",
    saleStatus: "cancelled" as const,
    deliveryMode: "online" as const,
    saleStartTime: new Date("2030-06-01T10:00:00"),
    saleEndTime: new Date("2030-06-01T18:00:00"),
    canEditDraft: false,
    canAddLots: false,
    lots: [
      {
        id: "lot-1",
        title: "Work",
        lotNumber: 1,
        status: "cancelled" as const,
        winnerId: null,
      },
    ],
  };

  it("hides return to inventory when canManageAuction is false", () => {
    render(<SaleLotsTabSection {...baseProps} canManageAuction={false} />);
    expect(screen.queryByText(/return lots to inventory/i)).not.toBeInTheDocument();
  });

  it("shows return to inventory when canManageAuction is true", () => {
    render(<SaleLotsTabSection {...baseProps} canManageAuction />);
    expect(screen.getByText(/return lots to inventory/i)).toBeInTheDocument();
  });
});
