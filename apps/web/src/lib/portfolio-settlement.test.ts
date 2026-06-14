import type { PortfolioRow } from "@auction/types";
import { describe, expect, it } from "vitest";
import { dashboardSofRequirementsUrl } from "./dashboard/dashboard-copy";
import {
  portfolioSettlementAttentionAction,
  portfolioSettlementLabel,
} from "./portfolio-settlement";

function row(partial: Partial<PortfolioRow> = {}): PortfolioRow {
  return {
    lot: {
      id: "lot-1",
      title: "Test lot",
      status: "ended",
      endTime: new Date(),
    },
    payment: {
      status: "pending",
      manualReviewReason: null,
    },
    ...partial,
  } as PortfolioRow;
}

describe("portfolioSettlementAttentionAction", () => {
  it("routes source_of_funds_required to the compliance requirements page", () => {
    const action = portfolioSettlementAttentionAction(
      row({
        payment: {
          status: "pending",
          manualReviewReason: "source_of_funds_required",
        } as PortfolioRow["payment"],
      }),
    );
    expect(action.href).toBe(dashboardSofRequirementsUrl());
    expect(action.label).toBe("View requirements");
  });

  it("keeps checkout link for ordinary pending payments", () => {
    const action = portfolioSettlementAttentionAction(row());
    expect(action.href).toContain("/dashboard/checkout/lot-1");
    expect(action.label).toBe("Complete checkout");
  });
});

describe("portfolioSettlementLabel", () => {
  it("shows compliance review for SoF holds", () => {
    expect(
      portfolioSettlementLabel(
        row({
          payment: {
            status: "pending",
            manualReviewReason: "source_of_funds_required",
          } as PortfolioRow["payment"],
        }),
      ),
    ).toBe("Compliance review");
  });
});
