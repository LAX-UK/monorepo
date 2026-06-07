import { SubmissionStatusHint } from "@/components/dashboard/submission-status-hint";
import { SUBMISSION_STATUS_HINTS } from "@/lib/marketing/sell-flow-copy";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SubmissionStatusHint", () => {
  it("renders status label and hint for submitted", () => {
    render(<SubmissionStatusHint status="submitted" />);
    expect(screen.getByTestId("submission-status-hint")).toHaveTextContent(
      SUBMISSION_STATUS_HINTS.submitted ?? "",
    );
  });

  it("returns null for draft (no hint configured)", () => {
    const { container } = render(<SubmissionStatusHint status="draft" />);
    expect(container).toBeEmptyDOMElement();
  });
});
