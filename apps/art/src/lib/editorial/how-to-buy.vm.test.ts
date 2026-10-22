import type { EditorialBlock } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { howToBuySteps } from "./how-to-buy.vm.js";

const text = (value: string): EditorialBlock => ({ type: "richText", spans: [{ text: value }] });
const heading = (value: string): EditorialBlock => ({ type: "heading", level: 2, text: value });
const faq = (...questions: string[]): EditorialBlock => ({
  type: "faqGroup",
  items: questions.map((question) => ({ question, answer: [{ text: "Answer" }] })),
});

describe("howToBuySteps", () => {
  it("opens a step at each level-2 heading with its prose and FAQ questions", () => {
    const result = howToBuySteps([
      text("Intro"),
      heading("1. Create your account"),
      text("First."),
      text("Second."),
      faq("What do I need?", "Can I buy as a company?"),
      heading("Enquire"),
      text("Use the button."),
    ]);
    expect(result?.preamble).toEqual([text("Intro")]);
    expect(result?.steps).toEqual([
      {
        title: "Create your account",
        paragraphs: [[{ text: "First." }], [{ text: "Second." }]],
        questions: ["What do I need?", "Can I buy as a company?"],
      },
      { title: "Enquire", paragraphs: [[{ text: "Use the button." }]], questions: [] },
    ]);
  });

  it("returns null with fewer than two steps so the authored body renders", () => {
    expect(howToBuySteps([heading("Only"), text("x")])).toBeNull();
    expect(howToBuySteps([text("No headings")])).toBeNull();
    expect(howToBuySteps([])).toBeNull();
  });

  it("returns null when a step holds blocks that cannot be shown inside a card", () => {
    expect(
      howToBuySteps([
        heading("One"),
        { type: "cardGrid", items: [{ title: "Enquire" }] },
        heading("Two"),
        text("x"),
      ]),
    ).toBeNull();
  });
});
