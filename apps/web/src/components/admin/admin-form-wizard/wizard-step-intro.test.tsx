import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WizardStepIntro } from "./wizard-step-intro";

describe("WizardStepIntro", () => {
  it("renders step position, title, body, and next hint", () => {
    render(
      <WizardStepIntro
        stepIndex={1}
        stepCount={4}
        copy={{
          title: "When and how this sale runs",
          body: "Choose online or onsite delivery.",
          nextHint: "Attach terms and documents",
        }}
      />,
    );

    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /When and how this sale runs/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Choose online or onsite delivery/i)).toBeInTheDocument();
    expect(screen.getByText(/Attach terms and documents/i)).toBeInTheDocument();
  });
});
