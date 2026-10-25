import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormActions } from "./form-section.js";
import { ReviewSection, StepHeader, StepIndicator } from "./wizard.js";

const steps = [
  { id: "identity", label: "Identity" },
  { id: "sale", label: "Sale and seller" },
  { id: "catalogue", label: "Catalogue" },
  { id: "review", label: "Check and create" },
];

describe("StepIndicator", () => {
  it("marks the current step and lets only done steps be revisited", () => {
    const go = vi.fn();
    render(<StepIndicator steps={steps} currentIndex={2} onStepClick={go} />);
    const nav = screen.getByRole("navigation", { name: "Steps" });
    expect(within(nav).getByText("Step 3 of 4: Catalogue")).toBeInTheDocument();
    const current = within(nav).getAllByRole("listitem")[2];
    expect(current).toHaveAttribute("aria-current", "step");
    const buttons = within(nav).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0] as HTMLElement);
    expect(go).toHaveBeenCalledWith(0);
  });

  it("does not offer going back while a step is busy", () => {
    render(<StepIndicator steps={steps} currentIndex={2} onStepClick={vi.fn()} disabled />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows descriptions in the vertical layout only", () => {
    const withHelp = [{ id: "a", label: "Identity", description: "Title and type" }];
    const { rerender } = render(<StepIndicator steps={withHelp} currentIndex={0} />);
    expect(screen.queryByText("Title and type")).not.toBeInTheDocument();
    rerender(<StepIndicator steps={withHelp} currentIndex={0} orientation="vertical" />);
    expect(screen.getByText("Title and type")).toBeInTheDocument();
  });
});

describe("StepIndicator, responsive", () => {
  it("renders one list that is a row on phones and a column with descriptions from lg", () => {
    const withHelp = [
      { id: "a", label: "Identity", description: "Title and type" },
      { id: "b", label: "Review" },
    ];
    render(<StepIndicator steps={withHelp} currentIndex={0} orientation="responsive" />);
    expect(screen.getAllByRole("list")).toHaveLength(1);
    expect(screen.getByText("Title and type")).toHaveClass("hidden", "lg:block");
    expect(screen.getByText("Step 1 of 2: Identity")).toBeInTheDocument();
  });
});

describe("StepHeader and ReviewSection", () => {
  it("names the step and what comes next", () => {
    render(<StepHeader title="Identity" description="What the lot is." next="Sale and seller" />);
    expect(screen.getByRole("heading", { level: 2, name: "Identity" })).toBeInTheDocument();
    expect(screen.getByText("Sale and seller")).toBeInTheDocument();
  });

  it("lists a step's answers with a Change link named for the step", () => {
    const change = vi.fn();
    render(
      <ReviewSection
        title="Identity"
        items={[
          { label: "Title", value: "Harbour at dusk" },
          { label: "Lot number", value: null },
        ]}
        onChange={change}
      />,
    );
    const section = screen.getByRole("region", { name: "Identity" });
    expect(within(section).getByText("Harbour at dusk")).toBeInTheDocument();
    expect(within(section).getByText("—")).toBeInTheDocument();
    fireEvent.click(within(section).getByRole("button", { name: "Change identity" }));
    expect(change).toHaveBeenCalled();
  });
});

describe("FormActions", () => {
  it("keeps the start actions apart from the primary group", () => {
    render(
      <FormActions sticky start={<button type="button">Cancel</button>}>
        <button type="submit">Save changes</button>
      </FormActions>,
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const save = screen.getByRole("button", { name: "Save changes" });
    expect(cancel.parentElement).not.toBe(save.parentElement);
    expect(save.closest(".sticky")).toBeTruthy();
  });
});
