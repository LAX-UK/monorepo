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
    expect(screen.getByTestId("wizard-next")).toHaveTextContent("Continue to details");
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

  it("keeps Back and Continue at the kit's lg height, not taller", () => {
    render(<WizardNav isFirst={false} isLast={false} onBack={vi.fn()} onNext={vi.fn()} />);
    for (const id of ["wizard-next", "wizard-back"]) {
      const button = screen.getByTestId(id);
      expect(button.className).toContain("min-h-11");
      expect(button.className).not.toContain("min-h-12");
    }
  });

  it("draws the sticky bar as an opaque surface with a top edge", () => {
    const { container } = render(
      <WizardNav isFirst isLast={false} onBack={vi.fn()} onNext={vi.fn()} sticky />,
    );
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("sticky");
    expect(bar.className).toContain("border-t");
    expect(bar.className).toMatch(/\bbg-surface-container-lowest(\s|$)/);
    expect(bar.className).not.toMatch(/bg-surface-container-lowest\/|backdrop-blur/);
  });
});
