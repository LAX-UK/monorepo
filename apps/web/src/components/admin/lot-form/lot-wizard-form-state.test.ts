import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

type StepFormValues = {
  title: string;
  saleId: string;
  startingPrice: string;
};

/** Mirrors lot wizard: shouldUnregister false keeps values when steps unmount. */
describe("multi-step form state (shouldUnregister: false)", () => {
  it("retains step-0 values after simulating navigation away from step 0", () => {
    const { result } = renderHook(() =>
      useForm<StepFormValues>({
        defaultValues: { title: "", saleId: "", startingPrice: "0.00" },
        shouldUnregister: false,
      }),
    );

    act(() => {
      result.current.setValue("title", "Bronze figure", { shouldDirty: true });
      result.current.setValue("saleId", "00000000-0000-4000-8000-000000000001", {
        shouldDirty: true,
      });
    });

    // Step 0 fields unmounted; only step 2 field "registered" in UI — values remain in store.
    act(() => {
      result.current.setValue("startingPrice", "250.00", { shouldDirty: true });
    });

    expect(result.current.getValues()).toEqual({
      title: "Bronze figure",
      saleId: "00000000-0000-4000-8000-000000000001",
      startingPrice: "250.00",
    });
  });

  it("reset with merged baseline + draft restores saved step fields", () => {
    const baseline = { title: "", saleId: "", startingPrice: "0.00" };
    const { result } = renderHook(() =>
      useForm<StepFormValues>({
        defaultValues: baseline,
        shouldUnregister: false,
      }),
    );

    act(() => {
      result.current.reset(
        {
          ...baseline,
          title: "Resumed lot",
          startingPrice: "99.00",
        },
        { keepDefaultValues: false },
      );
    });

    expect(result.current.getValues("title")).toBe("Resumed lot");
    expect(result.current.getValues("startingPrice")).toBe("99.00");
    expect(result.current.getValues("saleId")).toBe("");
    expect(result.current.formState.isDirty).toBe(false);
  });
});
