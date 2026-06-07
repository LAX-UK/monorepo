import { SubmissionDraftContextStrip } from "@/components/dashboard/submission-wizard/submission-draft-context-strip";
import { SUBMISSION_AUTOSAVE_EXPLAINER } from "@/lib/marketing/sell-flow-copy";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SubmissionDraftContextStrip", () => {
  it("shows autosave explainer and status when enabled", () => {
    const savedAt = new Date("2026-06-07T14:30:00");
    render(
      <SubmissionDraftContextStrip autosaveStatus="saved" lastSavedAt={savedAt} showAutosave />,
    );

    expect(screen.getByText(SUBMISSION_AUTOSAVE_EXPLAINER)).toBeInTheDocument();
    expect(screen.getByTestId("wizard-context-status")).toHaveTextContent(/Saved ·/);
  });

  it("hides autosave line when showAutosave is false", () => {
    render(
      <SubmissionDraftContextStrip
        autosaveStatus="saved"
        lastSavedAt={new Date()}
        showAutosave={false}
      />,
    );

    expect(screen.queryByTestId("wizard-context-status")).not.toBeInTheDocument();
  });
});
