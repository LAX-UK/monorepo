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

  it("sets the step header and step names in sentence case at 12px or more", () => {
    render(<WizardProgress steps={STEPS} currentIndex={1} variant="chips" />);
    const header = screen.getByText(/Step 2 of 3 · Details/);
    const chipLabel = screen.getByText("Review");
    for (const el of [header, chipLabel]) {
      expect(el.className).not.toMatch(/uppercase|tracking-/);
      expect(el.className).not.toMatch(/text-\[(9|10|11)px\]/);
      expect(el).toHaveClass("text-xs");
    }
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

  it("marks completed steps by id when navigating back", () => {
    render(
      <WizardProgress
        steps={STEPS}
        currentIndex={0}
        completedStepIds={["b", "c"]}
        variant="chips"
      />,
    );

    expect(screen.getByText("Review").parentElement?.textContent).toContain("✓");
  });
});
