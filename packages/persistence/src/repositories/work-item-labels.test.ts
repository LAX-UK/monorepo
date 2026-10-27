import { describe, expect, it } from "vitest";
import { lotWorkItemTitle, sentenceCase } from "./work-item-labels.js";

describe("lotWorkItemTitle", () => {
  it("names the lot number when there is one", () => {
    expect(lotWorkItemTitle("Fulfilment", 4, "Golden Hour")).toBe(
      "Fulfilment — Lot 4: Golden Hour",
    );
  });

  it("leaves the number out for a lot that has none", () => {
    expect(lotWorkItemTitle("Fulfilment", null, "Golden Hour")).toBe("Fulfilment — Golden Hour");
  });
});

describe("sentenceCase", () => {
  it("turns a status key into a sentence", () => {
    expect(sentenceCase("awaiting_release")).toBe("Awaiting release");
  });
});
