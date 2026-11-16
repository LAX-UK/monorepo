import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import { paymentStatusLabel } from "@/lib/presenters/status/finance";
import { paymentStatuses } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SofSettlementBreakdown } from "./sof-settlement-breakdown";

function detail(paymentStatus: string): AdminSourceOfFundsDetail {
  return {
    case: { currency: "GBP" },
    exposureAtOpenPence: 500000,
    currentActiveExposurePence: 500000,
    settlementItems: [
      {
        kind: "payment",
        lotId: "lot-1",
        lotTitle: "Harbour at dusk",
        lotNumber: 12,
        saleId: "sale-1",
        saleTitle: "Modern British",
        amountPence: 500000,
        paymentId: "pay-1",
        paymentStatus,
      },
    ],
  } as unknown as AdminSourceOfFundsDetail;
}

describe("SofSettlementBreakdown payment status", () => {
  it.each([
    ["requires_manual_review", "Manual review"],
    ["authorized", "Authorised"],
  ])("shows %s as %s, the payment badge's words", (status, label) => {
    render(<SofSettlementBreakdown detail={detail(status)} />);
    expect(screen.getByRole("cell", { name: label })).toBeInTheDocument();
  });

  it.each(paymentStatuses)("shows %s with its mapped label", (status) => {
    render(<SofSettlementBreakdown detail={detail(status)} />);
    expect(screen.getByRole("cell", { name: paymentStatusLabel[status] })).toBeInTheDocument();
  });
});
