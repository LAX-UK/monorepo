import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WizardVerticalStepper } from "./wizard-vertical-stepper";

const steps = [
  { id: "identity", label: "Identity", subItems: ["Details", "Media"] },
  { id: "schedule", label: "Schedule", description: "Opening and closing times" },
  { id: "review", label: "Review" },
];

describe("WizardVerticalStepper", () => {
  it("lists each step with its sub-sections or description", () => {
    render(<WizardVerticalStepper steps={steps} currentIndex={0} />);
    expect(screen.getByText("Details, Media")).toBeInTheDocument();
    expect(screen.getByText("Opening and closing times")).toBeInTheDocument();
    expect(screen.getByText("Identity").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("goes back to a done step, but not while a jump is pending", () => {
    const go = vi.fn();
    const { rerender } = render(
      <WizardVerticalStepper steps={steps} currentIndex={2} onStepClick={go} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Identity/ }));
    expect(go).toHaveBeenCalledWith(0);
    rerender(
      <WizardVerticalStepper
        steps={steps}
        currentIndex={2}
        onStepClick={go}
        stepNavigationDisabled
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
