import { WizardFooter } from "@/components/dashboard/submission-wizard/wizard-footer";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("WizardFooter", () => {
  it("renders Back and context-aware Continue label in footer", () => {
    render(
      <WizardFooter
        isLastStep={false}
        isSubmitting={false}
        autosaveStatus="idle"
        lastSavedAt={null}
        showAutosave={false}
        nextStepLabel="Details"
        onBack={vi.fn()}
        onNext={vi.fn()}
        canGoBack
      />,
    );

    expect(screen.getByTestId("wizard-next")).toHaveTextContent("Continue to Details");
    expect(screen.getByTestId("wizard-back")).toHaveTextContent("Back");
    expect(screen.queryByTestId("wizard-finish-later")).not.toBeInTheDocument();
  });

  it("falls back to Continue when nextStepLabel is omitted", () => {
    render(
      <WizardFooter
        isLastStep={false}
        isSubmitting={false}
        autosaveStatus="idle"
        lastSavedAt={null}
        showAutosave={false}
        onBack={vi.fn()}
        onNext={vi.fn()}
        canGoBack={false}
      />,
    );

    expect(screen.getByTestId("wizard-next")).toHaveTextContent("Continue");
  });

  it("calls onNext when Next is clicked", () => {
    const onNext = vi.fn();
    render(
      <WizardFooter
        isLastStep={false}
        isSubmitting={false}
        autosaveStatus="idle"
        lastSavedAt={null}
        showAutosave={false}
        onBack={vi.fn()}
        onNext={onNext}
        canGoBack={false}
      />,
    );

    fireEvent.click(screen.getByTestId("wizard-next"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("returns null on the last step", () => {
    const { container } = render(
      <WizardFooter
        isLastStep
        isSubmitting={false}
        autosaveStatus="idle"
        lastSavedAt={null}
        showAutosave={false}
        onBack={vi.fn()}
        onNext={vi.fn()}
        canGoBack
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
