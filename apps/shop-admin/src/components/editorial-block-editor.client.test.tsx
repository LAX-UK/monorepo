// @vitest-environment jsdom
import { EditorialBlockEditor } from "@/components/editorial-block-editor.client";
import { type EditorialBlockItem, fromBlockItems, toBlockItems } from "@/lib/editorial-blocks";
import type { EditorialBlock } from "@auction/shop-contracts";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/application/admin-editorial-links-actions.server", () => ({
  resolveRailSlugs: vi.fn(),
  searchEditorialLinkCandidates: vi.fn(),
}));

const FORMATTED: EditorialBlock = {
  type: "richText",
  spans: [
    { text: "Opening " },
    { text: "night", marks: ["bold"] },
    { text: " is ", marks: ["italic"] },
    { text: "free", marks: ["bold", "italic"] },
    { text: " , see ", marks: ["italic"] },
    { text: "visit", marks: ["link"], href: "/visit" },
  ],
};

const FAQ: EditorialBlock = {
  type: "faqGroup",
  items: [
    {
      question: "Can I return an artwork?",
      answer: [
        { text: "Yes, within " },
        { text: "14 days", marks: ["bold"] },
        { text: ". See ", marks: [] },
        { text: "returns", marks: ["link"], href: "https://lax.art/returns" },
      ],
    },
  ],
};

function items(...blocks: EditorialBlock[]): EditorialBlockItem[] {
  let n = 0;
  return toBlockItems(blocks, () => `k${++n}`);
}

function setup(...blocks: EditorialBlock[]) {
  const onChange = vi.fn();
  render(
    <StaffTooltipProvider>
      <EditorialBlockEditor
        items={items(...blocks)}
        errors={{}}
        disabled={false}
        onChange={onChange}
      />
    </StaffTooltipProvider>,
  );
  return { onChange };
}

beforeEach(() => {
  document.execCommand = vi.fn();
});

describe("paragraph block", () => {
  it("opens bold, italic and links as formatted text, never as JSON", () => {
    setup(FORMATTED);
    expect(screen.queryByLabelText(/Block JSON/)).not.toBeInTheDocument();
    const box = screen.getByRole("textbox", { name: /Paragraph/ });
    expect(box.querySelector("strong")?.textContent).toBe("night");
    expect(box.querySelectorAll("em").length).toBeGreaterThan(0);
    expect(box.querySelector("a")?.getAttribute("href")).toBe("/visit");
  });

  it("saves an edit in the same block format", () => {
    const { onChange } = setup(FORMATTED);
    const box = screen.getByRole("textbox", { name: /Paragraph/ });
    fireEvent.input(box);
    const [saved] = fromBlockItems(onChange.mock.calls[0]?.[0] as EditorialBlockItem[]);
    // Reading and writing back changes nothing but the canonical order of marks.
    expect(saved).toEqual({
      type: "richText",
      spans: [
        { text: "Opening " },
        { text: "night", marks: ["bold"] },
        { text: " is ", marks: ["italic"] },
        { text: "free", marks: ["bold", "italic"] },
        { text: " , see ", marks: ["italic"] },
        { text: "visit", marks: ["link"], href: "/visit" },
      ],
    });
  });

  it("writes new typing as plain runs and keeps the block's type", () => {
    const { onChange } = setup({ type: "richText", spans: [{ text: "" }] });
    const box = screen.getByRole("textbox", { name: /Paragraph/ });
    box.innerHTML = "Hello <em>world</em>";
    fireEvent.input(box);
    expect(fromBlockItems(onChange.mock.calls[0]?.[0] as EditorialBlockItem[])).toEqual([
      { type: "richText", spans: [{ text: "Hello " }, { text: "world", marks: ["italic"] }] },
    ]);
  });
});

describe("FAQ group", () => {
  it("is a question and a formatted answer, with no JSON", () => {
    setup(FAQ);
    expect(screen.queryByLabelText(/Block JSON/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Question 1/)).toHaveValue("Can I return an artwork?");
    const answer = screen.getByRole("textbox", { name: /Answer 1/ });
    expect(within(answer).getByText("14 days").tagName).toBe("STRONG");
    expect(within(answer).getByText("returns").getAttribute("href")).toBe(
      "https://lax.art/returns",
    );
  });

  it("saves an answer edit with its question and formatting intact", () => {
    const { onChange } = setup(FAQ);
    const answer = screen.getByRole("textbox", { name: /Answer 1/ });
    fireEvent.input(answer);
    expect(fromBlockItems(onChange.mock.calls[0]?.[0] as EditorialBlockItem[])).toEqual([
      {
        type: "faqGroup",
        items: [
          {
            question: "Can I return an artwork?",
            answer: [
              { text: "Yes, within " },
              { text: "14 days", marks: ["bold"] },
              { text: ". See " },
              { text: "returns", marks: ["link"], href: "https://lax.art/returns" },
            ],
          },
        ],
      },
    ]);
  });

  it("keeps the question when the question text changes", () => {
    const { onChange } = setup(FAQ);
    fireEvent.change(screen.getByLabelText(/^Question 1/), { target: { value: "New?" } });
    const [block] = fromBlockItems(onChange.mock.calls[0]?.[0] as EditorialBlockItem[]);
    expect(block).toMatchObject({ items: [{ question: "New?", answer: FAQ_ANSWER() }] });
  });
});

function FAQ_ANSWER() {
  return (FAQ as Extract<EditorialBlock, { type: "faqGroup" }>).items[0]?.answer;
}
