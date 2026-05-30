import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WizardDraftSaveIndicator } from "./wizard-draft-save-indicator";

describe("WizardDraftSaveIndicator", () => {
  it("shows saving state", () => {
    render(<WizardDraftSaveIndicator status="saving" />);
    expect(screen.getByText("Saving draft…")).toBeInTheDocument();
  });

  it("shows saved timestamp", () => {
    render(
      <WizardDraftSaveIndicator
        status="saved"
        savedAt={new Date(Date.now() - 60_000).toISOString()}
      />,
    );
    expect(screen.getByText(/Draft saved/i)).toBeInTheDocument();
  });
});
