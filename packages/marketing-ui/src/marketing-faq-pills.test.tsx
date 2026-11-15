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
  it("keeps the answers outside the group of pills", () => {
    render(<MarketingFaqPills items={ITEMS} />);
    const group = screen.getByRole("group", { name: "FAQs" });
    for (const answer of screen.getAllByTestId("marketing-faq-answer")) {
      expect(group).not.toContainElement(answer);
    }
    expect(group.querySelectorAll("input[type=radio]")).toHaveLength(2);
  });

  it("labels the section and offers each question as a keyboard-operable radio pill", () => {
    render(<MarketingFaqPills items={ITEMS} />);
    expect(screen.getByRole("heading", { name: "FAQs", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "FAQs" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();
  });

  it("shows the chosen answer and its link, one at a time", () => {
    render(<MarketingFaqPills items={ITEMS} />);
    expect(screen.getByRole("link", { name: "Plan a visit" })).toHaveAttribute("href", "/visit");
    fireEvent.click(screen.getByRole("radio", { name: "How do I contact the team?" }));
    expect(screen.getByRole("radio", { name: "How do I contact the team?" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Can I see the work in person?" })).not.toBeChecked();
  });

  it("renders nothing without questions", () => {
    const { container } = render(<MarketingFaqPills items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
