import { PaymentsMobileList } from "@/components/dashboard/list/payments-mobile-list";
import { PaymentRowCard } from "@/components/dashboard/payments/payment-row-card";
import type { PaymentDisplayRow } from "@/lib/data/view-models/dashboard-payments.vm";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shell/shell-config-context", () => ({
  useShellConfig: () => ({ density: "normal" }),
}));

const sampleRow: PaymentDisplayRow = {
  id: "p1",
  lotId: "l1",
  lotTitle: "Blue Canvas Study",
  lotImageUrl: null,
  amountLabel: "£14,814.80",
  createdAtLabel: "12 May 2025",
  createdAtIso: "2025-05-12T00:00:00.000Z",
  status: "authorized",
  statusLabel: "Authorized",
  statusTone: "info",
  primaryAction: { kind: "pay", href: "/dashboard/checkout/l1", label: "Pay now" },
  invoiceNumber: "INV-001",
  manualReviewReason: null,
};

describe("PaymentRowCard", () => {
  it("renders desktop grid with amount, status, and primary action", () => {
    render(
      <ul>
        <PaymentRowCard row={sampleRow} />
      </ul>,
    );

    expect(screen.getByRole("link", { name: "Blue Canvas Study" })).toBeInTheDocument();
    expect(screen.getByText("£14,814.80")).toBeInTheDocument();
    expect(screen.getByText("Authorized")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pay now" })).toBeInTheDocument();
  });
});

describe("PaymentsMobileList", () => {
  it("renders mobile payment cards with amount and status", () => {
    render(<PaymentsMobileList rows={[sampleRow]} />);

    const list = screen.getByRole("list");
    expect(within(list).getByText("£14,814.80")).toBeInTheDocument();
    expect(within(list).getByText("Authorized")).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "Pay now" })).toBeInTheDocument();
  });
});
