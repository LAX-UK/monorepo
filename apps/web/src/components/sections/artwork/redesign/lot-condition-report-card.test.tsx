import { LotConditionReportCard } from "@/components/sections/artwork/redesign/lot-condition-report-card";
import { deriveConditionReportCardState } from "@/lib/condition-report/derive-condition-report-card-state";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const onSubmitRequest = vi.fn().mockResolvedValue(true);

const baseProps = {
  onSubmitRequest,
  submitting: false,
  apiErrorMessage: null,
  onHide: vi.fn(),
  onRestore: vi.fn(),
  isDismissed: false,
};

function expandCard(name: RegExp = /condition report available|request a specialist/i) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("LotConditionReportCard", () => {
  it("renders published download link when expanded", () => {
    const state = deriveConditionReportCardState({
      show: true,
      lotEligible: true,
      isAuthenticated: true,
      kycApproved: true,
      kycFeedback: null,
      loginNextPath: "/lot/x",
      dashboardHref: "/dashboard/condition-reports",
      published: { downloadUrl: "https://cdn.example.com/report.pdf", summary: "Good" },
      buyerRequest: null,
      uiPhase: "idle",
      submitErrorMessage: null,
    });
    if (!state) throw new Error("expected published state");
    expect(state.kind).toBe("published");
    render(<LotConditionReportCard {...baseProps} state={state} />);
    expandCard(/condition report available/i);
    expect(screen.getByRole("link", { name: /view condition report/i })).toHaveAttribute(
      "href",
      "https://cdn.example.com/report.pdf",
    );
  });

  it("shows restore link when dismissed", () => {
    render(<LotConditionReportCard {...baseProps} state={{ kind: "canRequest" }} isDismissed />);
    expect(screen.getByRole("button", { name: /show condition report/i })).toBeInTheDocument();
  });

  it("expands panel and exposes request form", () => {
    render(<LotConditionReportCard {...baseProps} state={{ kind: "canRequest" }} />);
    const trigger = screen.getByRole("button", { name: /request a specialist/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText(/note for specialists/i)).toBeInTheDocument();
  });
});

describe("derive hides card after request", () => {
  it("returns null for pending buyer request without published PDF", () => {
    expect(
      deriveConditionReportCardState({
        show: true,
        lotEligible: true,
        isAuthenticated: true,
        kycApproved: true,
        kycFeedback: null,
        loginNextPath: "/lot/x",
        dashboardHref: "/dashboard/condition-reports",
        published: null,
        buyerRequest: {
          id: "req-1",
          lotId: "lot-1",
          status: "pending",
          requestNote: null,
          responseNote: null,
          createdAt: new Date().toISOString(),
        },
        uiPhase: "idle",
        submitErrorMessage: null,
      }),
    ).toBeNull();
  });
});
