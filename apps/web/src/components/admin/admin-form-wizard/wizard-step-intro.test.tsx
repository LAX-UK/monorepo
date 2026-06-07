import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WizardStepIntro } from "./wizard-step-intro";

describe("WizardStepIntro", () => {
  it("renders title, body, and next hint without duplicating the step counter", () => {
    render(
      <WizardStepIntro
        copy={{
          title: "When and how this sale runs",
          body: "Choose online or onsite delivery.",
          nextHint: "Attach terms and documents",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /When and how this sale runs/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Choose online or onsite delivery/i)).toBeInTheDocument();
    expect(screen.getByText(/Attach terms and documents/i)).toBeInTheDocument();
    // Counter belongs to WizardProgress, not the intro card.
    expect(screen.queryByText(/Step \d+ of \d+/)).not.toBeInTheDocument();
  });
});
