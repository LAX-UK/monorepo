import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManualReviewDrawerContent } from "./drawer";

vi.mock("@/components/admin/manual-review-payment-actions", () => ({
  ManualReviewPaymentActions: () => <div data-testid="actions" />,
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn() },
}));

const payment = {
  paymentId: "pay_secret_uuid_12345",
  lotId: "lot_secret_uuid_67890",
  lotTitle: "Vintage Chronograph",
  lotNumber: 42,
  winnerUserId: "user_secret_uuid",
  winnerEmail: "buyer@example.com",
  sellerDisplayName: "Archived Seller Ltd",
  amount: "1200.00",
  amountDisplay: { primary: "£1,200.00" },
  currency: "GBP",
  manualReviewReason: "seller_archived" as const,
  archiveReason: "Seller closed account",
  sellerLegalEntityId: "le_1",
  sellerStatus: "archived" as const,
  archiveTimestamp: "2024-06-01T12:00:00Z",
  sellerArchivedAt: "2024-06-01T12:00:00Z",
  createdAt: "2024-06-01T10:00:00Z",
  sourceOfFundsCaseId: null,
};

describe("ManualReviewDrawerContent", () => {
  it("hides payment ID until reference IDs are expanded", () => {
    render(<ManualReviewDrawerContent payment={payment} />);
    expect(screen.queryByText("pay_secret_uuid_12345")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /show reference ids/i }));
    expect(screen.getByText("pay_secret_uuid_12345")).toBeTruthy();
  });

  it("shows human-readable fields in the default view", () => {
    render(<ManualReviewDrawerContent payment={payment} />);
    expect(screen.getByText("Vintage Chronograph")).toBeTruthy();
    expect(screen.getByText("buyer@example.com")).toBeTruthy();
    expect(screen.getByText("Lot 42")).toBeTruthy();
  });

  it("shows Source of Funds case link when case id is present", () => {
    render(
      <ManualReviewDrawerContent
        payment={{
          ...payment,
          manualReviewReason: "source_of_funds_required",
          sourceOfFundsCaseId: "sof-case-uuid",
        }}
        canOpenComplianceQueues
      />,
    );
    const link = screen.getByRole("link", { name: /open source of funds case/i });
    expect(link.getAttribute("href")).toBe(
      "/admin/compliance/source-of-funds/sof-case-uuid?listStatus=pending",
    );
  });
});
