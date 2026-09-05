import { SUBMISSION_STATUS_HINTS } from "@/lib/marketing/sell-flow-copy";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubmissionStatusBadge } from "./submission-status-badge";

describe("SubmissionStatusBadge", () => {
  const cases: Array<{
    status: Parameters<typeof SubmissionStatusBadge>[0]["status"];
    label: string;
  }> = [
    { status: "draft", label: "Draft" },
    { status: "submitted", label: "Submitted" },
    { status: "under_review", label: "Under review" },
    { status: "approved", label: "Accepted" },
    { status: "rejected", label: "Not accepted" },
    { status: "withdrawn", label: "Withdrawn" },
    { status: "converted", label: "Catalogue prep" },
  ];

  for (const { status, label } of cases) {
    it(`renders the human label "${label}" for status "${status}"`, () => {
      render(<SubmissionStatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  }

  it("never renders raw underscore-separated enum values", () => {
    render(<SubmissionStatusBadge status="under_review" />);
    expect(screen.queryByText("under_review")).not.toBeInTheDocument();
  });

  it("shows a hint button that opens the status explanation in a popover", () => {
    render(<SubmissionStatusBadge status="submitted" />);

    const hintButton = screen.getByRole("button", { name: /What Submitted means/i });
    expect(hintButton).toBeInTheDocument();

    fireEvent.click(hintButton);

    expect(screen.getByText(SUBMISSION_STATUS_HINTS.submitted ?? "")).toBeInTheDocument();
  });

  it("opens hint on hover when the primary input supports hover", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query === "(hover: hover) and (pointer: fine)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });

    render(<SubmissionStatusBadge status="submitted" />);

    const hintButton = screen.getByRole("button", { name: /What Submitted means/i });
    fireEvent.mouseEnter(hintButton);

    expect(screen.getByText(SUBMISSION_STATUS_HINTS.submitted ?? "")).toBeInTheDocument();
  }, 15_000);

  it("hides the hint button when showHint is false", () => {
    render(<SubmissionStatusBadge status="submitted" showHint={false} />);

    expect(screen.queryByRole("button", { name: /What Submitted means/i })).not.toBeInTheDocument();
  });
});
