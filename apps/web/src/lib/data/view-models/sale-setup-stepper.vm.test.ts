import { describe, expect, it } from "vitest";
import { buildSaleEditStepperSteps, buildSaleSetupStepperSteps } from "./sale-setup-stepper.vm";

describe("buildSaleSetupStepperSteps", () => {
  it("returns 6 Figma-labelled steps including Review", () => {
    const steps = buildSaleSetupStepperSteps();
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.label)).toEqual([
      "Sale Information",
      "Schedule",
      "Documents",
      "Lots",
      "Catalog",
      "Review",
    ]);
  });

  it("adds identity sub-items for Sale Information", () => {
    const identity = buildSaleSetupStepperSteps()[0];
    expect(identity?.id).toBe("identity");
    expect(identity?.subItems).toEqual(["Details", "Media", "Discovery"]);
    expect(identity?.description).toBeTruthy();
  });

  it("adds Figma sub-items for schedule, documents, and lots", () => {
    const steps = buildSaleSetupStepperSteps();
    expect(steps[1]?.subItems).toEqual(["Auction format", "Schedule", "Commercial settings"]);
    expect(steps[2]?.subItems).toEqual(["Internal documents", "Public documents", "Terms of sale"]);
    expect(steps[3]?.subItems).toEqual(["Choose type", "Lot details", "Review lots"]);
  });
});

describe("buildSaleEditStepperSteps", () => {
  it("returns 4 edit steps with Figma labels", () => {
    const steps = buildSaleEditStepperSteps();
    expect(steps).toHaveLength(4);
    expect(steps[0]?.label).toBe("Sale Information");
    expect(steps[0]?.subItems).toEqual(["Details", "Media", "Discovery"]);
    expect(steps[3]?.label).toBe("Review");
  });
});
