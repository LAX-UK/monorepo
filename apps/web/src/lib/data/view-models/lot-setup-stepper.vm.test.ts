import { describe, expect, it } from "vitest";
import {
  buildLotEditStepperSteps,
  buildLotSetupStepperSteps,
  buildLotSetupStepperViewModel,
} from "./lot-setup-stepper.vm";

describe("lot-setup-stepper.vm", () => {
  it("returns four Figma-aligned create steps", () => {
    const steps = buildLotSetupStepperSteps();
    expect(steps).toHaveLength(4);
    expect(steps.map((s) => s.id)).toEqual(["identity", "sale-seller", "catalogue", "review"]);
  });

  it("returns edit steps via view model helper", () => {
    const steps = buildLotSetupStepperViewModel("edit");
    expect(steps).toHaveLength(4);
    expect(buildLotEditStepperSteps().map((s) => s.label)).toContain("Lot identity");
  });
});
