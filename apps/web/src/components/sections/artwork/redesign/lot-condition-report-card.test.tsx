import { LotConditionReportCard } from "@/components/sections/artwork/redesign/lot-condition-report-card";
import { deriveConditionReportCardState } from "@/lib/condition-report/derive-condition-report-card-state";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const preloadForm = vi.fn();
vi.mock(
  "@/components/sections/artwork/redesign/condition-report-request-form.lazy",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("@/components/sections/artwork/redesign/condition-report-request-form.lazy")
      >();
    return {
      ...original,
      preloadConditionReportRequestForm: () => {
        preloadForm();
        return original.preloadConditionReportRequestForm();
      },
    };
  },
);

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
      isAuthenticated: true,
      emailVerified: true,
      userEmail: "buyer@example.com",
      kycStatus: "approved",
      kycFeedback: null,
      loginNextPath: "/lot/x",
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

  it("starts fetching the request form when the trigger is approached or focused", () => {
    preloadForm.mockClear();
    render(<LotConditionReportCard {...baseProps} state={{ kind: "canRequest" }} />);
    const trigger = screen.getByRole("button", { name: /request a specialist/i });
    fireEvent.pointerEnter(trigger);
    expect(preloadForm).toHaveBeenCalledTimes(1);
    fireEvent.focus(trigger);
    expect(preloadForm).toHaveBeenCalledTimes(2);
  });

  it("does not fetch the form for a state that never shows it", () => {
    preloadForm.mockClear();
    render(<LotConditionReportCard {...baseProps} state={{ kind: "notSignedIn" } as never} />);
    for (const button of screen.getAllByRole("button")) fireEvent.pointerEnter(button);
    expect(preloadForm).not.toHaveBeenCalled();
  });

  it("expands panel and exposes request form, fetched when the panel opens", async () => {
    render(<LotConditionReportCard {...baseProps} state={{ kind: "canRequest" }} />);
    const trigger = screen.getByRole("button", { name: /request a specialist/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByLabelText(/note for specialists/i)).toBeInTheDocument();
  });
});

describe("derive hides card after request", () => {
  it("returns null for pending buyer request without published PDF", () => {
    expect(
      deriveConditionReportCardState({
        show: true,
        isAuthenticated: true,
        emailVerified: true,
        userEmail: "buyer@example.com",
        kycStatus: "approved",
        kycFeedback: null,
        loginNextPath: "/lot/x",
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
