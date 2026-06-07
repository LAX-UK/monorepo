import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WizardNav } from "./wizard-nav.js";

describe("WizardNav", () => {
  it("renders context-aware Continue label and Back", () => {
    render(
      <WizardNav
        isFirst={false}
        isLast={false}
        onBack={vi.fn()}
        onNext={vi.fn()}
        nextStepLabel="Details"
      />,
    );
    expect(screen.getByTestId("wizard-next")).toHaveTextContent("Continue to Details");
    expect(screen.getByTestId("wizard-back")).toHaveTextContent("Back");
  });

  it("falls back to Continue without a next label", () => {
    render(<WizardNav isFirst isLast={false} onBack={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByTestId("wizard-next")).toHaveTextContent("Continue");
    expect(screen.queryByTestId("wizard-back")).not.toBeInTheDocument();
  });

  it("shows submit slot on the last step instead of Continue", () => {
    render(
      <WizardNav
        isFirst={false}
        isLast
        onBack={vi.fn()}
        onNext={vi.fn()}
        submitSlot={<button type="button">Submit</button>}
      />,
    );
    expect(screen.queryByTestId("wizard-next")).not.toBeInTheDocument();
    expect(screen.getByText("Submit")).toBeInTheDocument();
  });

  it("calls onNext when Continue is clicked", () => {
    const onNext = vi.fn();
    render(<WizardNav isFirst isLast={false} onBack={vi.fn()} onNext={onNext} />);
    fireEvent.click(screen.getByTestId("wizard-next"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
