import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingFaqPills } from "./marketing-faq-pills.js";

const ITEMS = [
  {
    id: "viewing",
    question: "Can I see the work in person?",
    answer: "Yes, by appointment.",
    link: { label: "Plan a visit", href: "/visit" },
  },
  { id: "contact", question: "How do I contact the team?", answer: "Call or email us." },
];

describe("MarketingFaqPills", () => {
  it("opens an answer in place from its question", () => {
    const { container } = render(<MarketingFaqPills items={ITEMS} />);
    expect(screen.getByRole("heading", { name: "FAQs" })).toBeInTheDocument();
    const first = container.querySelector("details") as HTMLDetailsElement;
    expect(first.open).toBe(false);
    fireEvent.click(screen.getByText("Can I see the work in person?"));
    expect(first.open).toBe(true);
    expect(screen.getByRole("link", { name: "Plan a visit" })).toHaveAttribute("href", "/visit");
  });

  it("renders nothing without questions", () => {
    const { container } = render(<MarketingFaqPills items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
