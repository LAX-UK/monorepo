import { describe, expect, it } from "vitest";
import {
  addPrintsLabel,
  emptyStockBatchForm,
  stockBatchBody,
  stockBatchOutcome,
  validateStockBatchForm,
  withQuantity,
} from "./stock-batch-form";

describe("add prints", () => {
  it("proposes the split from the run's default until staff change it", () => {
    const start = emptyStockBatchForm(50);
    expect(start).toMatchObject({ quantityText: "10", artistText: "5", laxText: "5" });
    expect(withQuantity(start, "7", 50)).toMatchObject({ artistText: "4", laxText: "3" });
    const edited = { ...start, artistText: "10", laxText: "0", splitEdited: true };
    expect(withQuantity(edited, "10", 50)).toMatchObject({ artistText: "10", laxText: "0" });
  });

  it("checks the count, that the split adds up, and where printed stock is kept", () => {
    expect(validateStockBatchForm({ ...emptyStockBatchForm(50), quantityText: "0" })).toEqual({
      quantity: "Enter how many prints, 1 to 500",
    });
    expect(
      validateStockBatchForm({ ...emptyStockBatchForm(50), artistText: "6", splitEdited: true }),
    ).toEqual({ split: "The artist's and LAX's prints must add up to 10" });
    expect(validateStockBatchForm({ ...emptyStockBatchForm(50), custody: "stored" })).toEqual({
      storageLocation: "Say where the printed stock is stored",
    });
  });

  it("says which stock references it creates and sends the batch", () => {
    const values = {
      ...emptyStockBatchForm(50),
      custody: "stored" as const,
      storageLocation: " Plan chest C ",
    };
    expect(stockBatchOutcome(values, 41)).toBe(
      "Creates OE-0041 to OE-0050. LAX prints go on sale now; the artist's go on sale when they offer them.",
    );
    expect(addPrintsLabel(values)).toBe("Add 10 prints");
    expect(stockBatchBody(values)).toEqual({
      artistCount: 5,
      laxCount: 5,
      custody: "stored",
      storageLocation: "Plan chest C",
    });
  });
});
