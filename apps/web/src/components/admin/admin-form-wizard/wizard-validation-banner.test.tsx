import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WizardValidationBanner } from "./wizard-validation-banner";

describe("WizardValidationBanner", () => {
  it("renders message and jump action", () => {
    const onJump = vi.fn();

    render(
      <WizardValidationBanner
        message="3 fields need attention on Catalogue"
        stepLabel="Catalogue"
        onJumpToStep={onJump}
      />,
    );

    expect(screen.getByText(/3 fields need attention/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Go to step/i }));
    expect(onJump).toHaveBeenCalledOnce();
  });
});
