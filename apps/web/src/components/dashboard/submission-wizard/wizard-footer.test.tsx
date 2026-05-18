import { WizardFooter } from "@/components/dashboard/submission-wizard/wizard-footer";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("WizardFooter", () => {
  it("renders only Back and Next on mobile layout (no save-and-leave in footer)", () => {
    render(
      <WizardFooter
        isLastStep={false}
        isSubmitting={false}
        autosaveStatus="idle"
        lastSavedAt={null}
        showAutosave={false}
        onBack={vi.fn()}
        onNext={vi.fn()}
        canGoBack
      />,
    );

    expect(screen.getByTestId("wizard-next")).toHaveTextContent("Next");
    expect(screen.getByTestId("wizard-back")).toHaveTextContent("Back");
    expect(screen.queryByTestId("wizard-save-and-leave")).not.toBeInTheDocument();
    expect(screen.queryByText(/save and continue later/i)).not.toBeInTheDocument();
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
