import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingFaqAccordion } from "./marketing-faq-accordion.js";

const ITEMS = [
  {
    id: "viewing",
    question: "Can I see the work in person?",
    answer: "Yes, by appointment.",
    link: { label: "Plan a visit", href: "/visit" },
  },
  { id: "contact", question: "How do I contact the team?", answer: "Call or email us." },
];

describe("MarketingFaqAccordion", () => {
  it("labels the section and opens an answer in place from its question", () => {
    render(<MarketingFaqAccordion items={ITEMS} />);
    expect(screen.getByRole("heading", { name: "FAQs", level: 2 })).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Can I see the work in person?" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Yes, by appointment.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan a visit" })).toHaveAttribute("href", "/visit");
  });

  it("renders nothing without questions", () => {
    const { container } = render(<MarketingFaqAccordion items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
