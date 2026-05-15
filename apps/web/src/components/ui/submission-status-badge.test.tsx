import { render, screen } from "@testing-library/react";
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
    { status: "approved", label: "Approved" },
    { status: "rejected", label: "Rejected" },
    { status: "withdrawn", label: "Withdrawn" },
    { status: "converted", label: "Converted" },
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
});
