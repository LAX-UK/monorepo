import { renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { emptyAdminLotFormValues } from "../forms/schemas/admin-lot-defaults";
import type { AdminLotFormValues } from "../forms/schemas/admin-lot-form";
import { moveLotFormToZone } from "./lot-form-zone";

function setup(values: Partial<AdminLotFormValues>) {
  return renderHook(() =>
    useForm<AdminLotFormValues>({ defaultValues: { ...emptyAdminLotFormValues(), ...values } }),
  ).result.current;
}

describe("moveLotFormToZone", () => {
  it("keeps the lot's moments and rewrites them on the sale's clock", () => {
    const form = setup({ startTime: "2030-11-12T18:00", endTime: "2030-11-19T18:00" });
    moveLotFormToZone(form, "America/New_York");
    expect(form.getValues("timeZone")).toBe("America/New_York");
    // 18:00 in London is 13:00 in New York: the instant is unchanged, only relabelled.
    expect(form.getValues("startTime")).toBe("2030-11-12T13:00");
    expect(form.getValues("endTime")).toBe("2030-11-19T13:00");
  });

  it("does nothing when the form already reads in that zone", () => {
    const form = setup({ startTime: "2030-11-12T18:00", timeZone: "Europe/Paris" });
    moveLotFormToZone(form, "Europe/Paris");
    expect(form.getValues("startTime")).toBe("2030-11-12T18:00");
  });

  it("leaves empty times empty", () => {
    const form = setup({ startTime: "", endTime: "" });
    moveLotFormToZone(form, "Asia/Dubai");
    expect(form.getValues("startTime")).toBe("");
    expect(form.getValues("timeZone")).toBe("Asia/Dubai");
  });
});
