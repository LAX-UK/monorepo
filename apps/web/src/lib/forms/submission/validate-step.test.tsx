import { itemSubmissionFormSchema } from "@auction/validators";
import type { ItemSubmissionFormValues } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { EMPTY_SUBMISSION_FORM_VALUES } from "./item-submission-form-defaults";
import { WIZARD_STEPS } from "./step-validation";
import { validateStep } from "./validate-step";

function setup(values: Partial<ItemSubmissionFormValues> = {}) {
  return renderHook(() =>
    useForm<ItemSubmissionFormValues>({
      resolver: zodResolver(itemSubmissionFormSchema),
      defaultValues: { ...EMPTY_SUBMISSION_FORM_VALUES, ...values },
    }),
  );
}

function step(id: string) {
  const found = WIZARD_STEPS.find((s) => s.id === id);
  if (!found) throw new Error(id);
  return found;
}

describe("validateStep", () => {
  it("marks the title and the category with the form's own words, once each", async () => {
    const { result } = setup();
    let ok = true;
    await act(async () => {
      ok = await validateStep(result.current, step("basics"));
    });
    expect(ok).toBe(false);
    expect(result.current.getFieldState("title").error?.message).toBe(
      "Enter the title of the work",
    );
    expect(result.current.getFieldState("categoryIds").error?.message).toBe("Choose a category");
  });

  it("asks for a photo, which the schema alone lets through", async () => {
    const { result } = setup();
    let ok = true;
    await act(async () => {
      ok = await validateStep(result.current, step("photos"));
    });
    expect(ok).toBe(false);
    expect(result.current.getFieldState("images").error?.message).toBe("Add at least one photo");
  });

  it("is clear when the step has what it needs", async () => {
    const { result } = setup({ images: ["submissions/a.jpg"] });
    let ok = false;
    await act(async () => {
      ok = await validateStep(result.current, step("photos"));
    });
    expect(ok).toBe(true);
    expect(result.current.getFieldState("images").error).toBeUndefined();
  });

  it("words a bad price the same way on both price fields", async () => {
    const { result } = setup({ askingPrice: "12x", reservePrice: "" });
    let ok = true;
    await act(async () => {
      ok = await validateStep(result.current, step("pricing"));
    });
    expect(ok).toBe(false);
    expect(result.current.getFieldState("askingPrice").error?.message).toBe(
      "Enter a price in pounds, like 2,500",
    );
    expect(result.current.getFieldState("reservePrice").error).toBeUndefined();
  });
});
