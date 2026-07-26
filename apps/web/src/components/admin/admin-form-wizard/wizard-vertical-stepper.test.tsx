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
    subItems: ["Auction format", "Timing", "Commercial settings"],
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
    expect(screen.getByText("Auction format")).toBeInTheDocument();
  });

  it("shows future sub-labels for unreached steps", () => {
    render(<WizardVerticalStepper steps={STEPS} currentIndex={0} />);

    expect(screen.getByText("Auction format")).toBeInTheDocument();
    expect(screen.getByText("Timing")).toBeInTheDocument();
    expect(screen.getByText("Commercial settings")).toBeInTheDocument();
    expect(screen.getAllByText("Schedule")[0]).toHaveClass("text-on-surface-variant");
  });

  it("shows muted descriptions on future steps without sub-labels", () => {
    render(<WizardVerticalStepper steps={STEPS} currentIndex={0} />);

    const futureDescription = screen.getByText(/Add sale terms bidders see/i);
    expect(futureDescription).toHaveClass("text-on-surface-variant/50");
  });

  it("renders vertical connectors between steps", () => {
    render(<WizardVerticalStepper steps={STEPS} currentIndex={1} />);

    const connectors = screen.getAllByTestId("wizard-step-connector");
    expect(connectors.length).toBe(2);
  });

  it("uses information-color dots for active and completed steps", () => {
    const { container } = render(<WizardVerticalStepper steps={STEPS} currentIndex={1} />);
    const infoDots = container.querySelectorAll(".bg-info");
    expect(infoDots.length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".bg-secondary").length).toBe(0);
  });

  it("uses muted dots for future steps", () => {
    const { container } = render(<WizardVerticalStepper steps={STEPS} currentIndex={0} />);
    const futureDots = container.querySelectorAll(".bg-on-surface-variant\\/40");
    expect(futureDots.length).toBeGreaterThan(0);
  });

  it("supports step navigation clicks", () => {
    const onStepClick = vi.fn();
    render(<WizardVerticalStepper steps={STEPS} currentIndex={0} onStepClick={onStepClick} />);

    screen.getByRole("button", { name: /Schedule/i }).click();
    expect(onStepClick).toHaveBeenCalledWith(1);
  });

  it("marks the active step with aria-current", () => {
    render(<WizardVerticalStepper steps={STEPS} currentIndex={1} onStepClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Schedule/i })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByRole("button", { name: /Sale Information/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("disables navigation while step jumps are pending", () => {
    render(
      <WizardVerticalStepper
        steps={STEPS}
        currentIndex={0}
        onStepClick={vi.fn()}
        stepNavigationDisabled
      />,
    );

    expect(screen.getByRole("button", { name: /Schedule/i })).toBeDisabled();
  });
});
