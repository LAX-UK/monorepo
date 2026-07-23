import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WizardVerticalStepper } from "./wizard-vertical-stepper";

const STEPS = [
  {
    id: "identity",
    label: "Sale Information",
    subItems: ["Details", "Media", "Discovery"],
    description: "Add a title and optional cover image.",
  },
  {
    id: "schedule",
    label: "Schedule",
    description: "Choose online or onsite delivery.",
  },
  {
    id: "documents",
    label: "Documents",
    description: "Add sale terms bidders see on the public sale page.",
  },
] as const;

describe("WizardVerticalStepper", () => {
  it("shows sub-labels on the active identity step", () => {
    render(<WizardVerticalStepper steps={STEPS} currentIndex={0} />);

    expect(screen.getByText("Sale Information")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Media")).toBeInTheDocument();
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.queryByText(/Add a title and optional cover image/i)).not.toBeInTheDocument();
  });

  it("keeps completed identity sub-labels when a later step is active", () => {
    render(<WizardVerticalStepper steps={STEPS} currentIndex={1} />);

    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText(/Choose online or onsite delivery/i)).toBeInTheDocument();
  });

  it("shows muted descriptions on future steps", () => {
    render(<WizardVerticalStepper steps={STEPS} currentIndex={0} />);

    const futureDescription = screen.getByText(/Choose online or onsite delivery/i);
    expect(futureDescription).toHaveClass("text-on-surface-variant/50");
  });

  it("supports step navigation clicks", () => {
    const onStepClick = vi.fn();
    render(<WizardVerticalStepper steps={STEPS} currentIndex={0} onStepClick={onStepClick} />);

    screen.getByRole("button", { name: /Schedule/i }).click();
    expect(onStepClick).toHaveBeenCalledWith(1);
  });

  it("uses midnight secondary dots for reached steps", () => {
    const { container } = render(<WizardVerticalStepper steps={STEPS} currentIndex={1} />);
    const reachedDots = container.querySelectorAll(".bg-secondary");
    expect(reachedDots.length).toBeGreaterThan(0);
  });
});
