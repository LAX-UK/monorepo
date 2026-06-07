import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WizardProgress, type WizardProgressStep } from "./wizard-progress.js";

const STEPS: WizardProgressStep[] = [
  { id: "a", label: "Basics" },
  { id: "b", label: "Details" },
  { id: "c", label: "Review" },
];

describe("WizardProgress", () => {
  it("renders Step N of M with current label (bar variant)", () => {
    render(<WizardProgress steps={STEPS} currentIndex={1} />);
    expect(screen.getByText(/Step 2 of 3 · Details/)).toBeInTheDocument();
  });

  it("shows up-next hint when enabled and a next step exists", () => {
    render(<WizardProgress steps={STEPS} currentIndex={0} showUpNext />);
    expect(screen.getByText(/Up next: Details/)).toBeInTheDocument();
  });

  it("renders clickable chips and gates future steps via maxReachableIndex", () => {
    const onStepClick = vi.fn();
    render(
      <WizardProgress
        steps={STEPS}
        currentIndex={0}
        maxReachableIndex={0}
        onStepClick={onStepClick}
        variant="chips"
      />,
    );

    fireEvent.click(screen.getByText("Review"));
    expect(onStepClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Basics"));
    expect(onStepClick).toHaveBeenCalledWith(0);
  });
});
