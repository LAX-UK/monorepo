import { BasicsStep } from "@/components/dashboard/submission-wizard/steps/basics-step";
import { PhotosStep } from "@/components/dashboard/submission-wizard/steps/photos-step";
import { EMPTY_SUBMISSION_FORM_VALUES } from "@/lib/forms/submission/item-submission-form-defaults";
import { stepUsesSummary } from "@/lib/forms/submission/step-errors";
import { WIZARD_STEPS } from "@/lib/forms/submission/step-validation";
import { useStepErrorSummary } from "@/lib/forms/submission/use-step-error-summary";
import { validateStep } from "@/lib/forms/submission/validate-step";
import { Form } from "@auction/ui/components/form";
import { ErrorSummary } from "@auction/ui/lax/error-summary";
import { itemSubmissionFormSchema } from "@auction/validators";
import type { ItemSubmissionFormValues } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/forms/image-gallery-manager", () => ({
  ImageGalleryManager: () => <div role="button" tabIndex={0} aria-label="Add photos" />,
}));
vi.mock("@/components/marketing/sell-journey/sell-prerequisites-inline", () => ({
  SellPrerequisitesInline: () => null,
}));

function stepNamed(id: "basics" | "photos") {
  const step = WIZARD_STEPS.find((s) => s.id === id);
  if (!step) throw new Error(id);
  return step;
}

/** One step of the form with its Continue, wired the way the wizard wires it. */
function StepHarness({ id }: { id: "basics" | "photos" }) {
  const form = useForm<ItemSubmissionFormValues>({
    resolver: zodResolver(itemSubmissionFormSchema),
    defaultValues: EMPTY_SUBMISSION_FORM_VALUES,
    mode: "onTouched",
    reValidateMode: "onChange",
  });
  const step = stepNamed(id);
  const summary = useStepErrorSummary(form, step);
  return (
    <Form {...form}>
      <form>
        {summary.items.length > 0 ? (
          <ErrorSummary errors={summary.items} focusKey={summary.focusKey} />
        ) : null}
        {id === "basics" ? (
          <BasicsStep form={form} isSubmitting={false} categories={[]} />
        ) : (
          <PhotosStep form={form} isSubmitting={false} />
        )}
        <button
          type="button"
          onClick={async () => {
            if (!(await validateStep(form, step))) summary.markFailedTry();
          }}
        >
          Continue
        </button>
      </form>
    </Form>
  );
}

describe("a step with several fields", () => {
  it("lists each problem at the top and says it again under its field, in the same words", async () => {
    render(<StepHarness id="basics" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const summary = await screen.findByText("There is a problem");
    const alert = summary.closest("[role=alert]") as HTMLElement;
    expect(
      within(alert).getByRole("link", { name: "Enter the title of the work" }),
    ).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: "Choose a category" })).toBeInTheDocument();
    // The same sentence sits under each field.
    expect(screen.getAllByText("Enter the title of the work")).toHaveLength(2);
    expect(screen.getAllByText("Choose a category")).toHaveLength(2);
  });

  it("links each line to its field, and a line goes when its field is put right", async () => {
    render(<StepHarness id="basics" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const link = await screen.findByRole("link", { name: "Enter the title of the work" });
    expect(link.getAttribute("href")).toBe("#sell-field-title-form-item");
    expect(document.getElementById("sell-field-title-form-item")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    fireEvent.change(screen.getByPlaceholderText("Work title"), { target: { value: "Blue" } });
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: "Enter the title of the work" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "Choose a category" })).toBeInTheDocument();
  });
});

describe("a step that is one control", () => {
  it("says the problem once, under the control, with no list at the top", async () => {
    expect(stepUsesSummary(stepNamed("photos"))).toBe(false);
    render(<StepHarness id="photos" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Add at least one photo");
    expect(screen.getAllByText("Add at least one photo")).toHaveLength(1);
    expect(screen.queryByText("There is a problem")).not.toBeInTheDocument();
  });
});
