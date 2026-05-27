import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import {
  applyZodIssuesToForm,
  findOwningStepIndex,
  findOwningTabValue,
} from "./apply-action-field-errors";

type TestForm = {
  title: string;
  saleId: string;
  startTime: string;
  estimate: { high: string };
};

describe("findOwningTabValue", () => {
  it("returns the tab that owns a field head", () => {
    expect(
      findOwningTabValue(
        { overview: ["title"], sale: ["saleId"], catalogue: ["startTime"] },
        "startTime",
      ),
    ).toBe("catalogue");
  });
});

describe("findOwningStepIndex", () => {
  it("returns step index for a field head", () => {
    expect(findOwningStepIndex<TestForm>([["title"], ["saleId"], ["startTime"]], "saleId")).toBe(1);
  });
});

describe("applyZodIssuesToForm", () => {
  it("navigates to tab and sets errors on nested paths", () => {
    const goToTab = vi.fn();
    const { result } = renderHook(() =>
      useForm<TestForm>({
        defaultValues: { title: "", saleId: "", startTime: "", estimate: { high: "" } },
      }),
    );

    act(() => {
      applyZodIssuesToForm(
        result.current,
        [
          { path: ["startTime"], message: "Start time required" },
          { path: ["estimate", "high"], message: "Too high" },
        ],
        {
          tabFields: {
            overview: ["title"],
            sale: ["saleId"],
            catalogue: ["startTime", "estimate"],
          },
          goToTab,
        },
      );
    });

    expect(goToTab).toHaveBeenCalledWith("catalogue");
    expect(result.current.getFieldState("startTime").error?.message).toBe("Start time required");
    expect(result.current.getFieldState("estimate.high").error?.message).toBe("Too high");
  });

  it("navigates to wizard step when stepFields provided", () => {
    const goTo = vi.fn();
    const { result } = renderHook(() =>
      useForm<TestForm>({
        defaultValues: { title: "", saleId: "", startTime: "", estimate: { high: "" } },
      }),
    );

    act(() => {
      applyZodIssuesToForm(result.current, [{ path: ["saleId"], message: "Choose a sale" }], {
        stepFields: [["title"], ["saleId"], ["startTime"]],
        goTo,
      });
    });

    expect(goTo).toHaveBeenCalledWith(1);
    expect(result.current.getFieldState("saleId").error?.message).toBe("Choose a sale");
  });
});
