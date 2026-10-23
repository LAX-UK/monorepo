import type { HelpArticleSummary, HelpCategorySummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  buildHelpCategoryChips,
  buildHelpSearchResults,
  buildRelatedQuestions,
  groupHelpQuestions,
  helpArticleHref,
  helpCategoryHref,
  helpResultsSummary,
  parseHelpParams,
} from "./help.vm";

const categories: HelpCategorySummary[] = [
  { slug: "buying", title: "Buying", articleCount: 2 },
  { slug: "returns", title: "Returns", articleCount: 1 },
  { slug: "empty", title: "Empty", articleCount: 0 },
];

function article(slug: string, categorySlug: string, categoryTitle: string): HelpArticleSummary {
  return { slug, question: `Question ${slug}?`, categorySlug, categoryTitle };
}

const articles = [
  article("pay", "buying", "Buying"),
  article("send-back", "returns", "Returns"),
  article("framing", "buying", "Buying"),
];

describe("parseHelpParams", () => {
  it("collapses whitespace in the search term and keeps a well-formed category", () => {
    expect(parseHelpParams({ q: "  how   do I\tpay ", category: "buying" })).toEqual({
      q: "how do I pay",
      category: "buying",
    });
  });

  it("takes the first value of a repeated parameter", () => {
    expect(parseHelpParams({ q: ["pay", "ship"], category: ["returns", "buying"] })).toEqual({
      q: "pay",
      category: "returns",
    });
  });

  it("drops a malformed category and caps the search term at the API limit", () => {
    const state = parseHelpParams({ q: "a".repeat(300), category: "Not A Slug!" });
    expect(state.q).toHaveLength(120);
    expect(state.category).toBeNull();
  });

  it("is empty without parameters", () => {
    expect(parseHelpParams({})).toEqual({ q: "", category: null });
  });
});

describe("hrefs", () => {
  it("encodes slugs", () => {
    expect(helpArticleHref("a b")).toBe("/help/a%20b");
    expect(helpCategoryHref("buying")).toBe("/help?category=buying");
  });
});

describe("buildHelpCategoryChips", () => {
  it("marks the selected category and carries the count", () => {
    const chips = buildHelpCategoryChips(categories, "returns");
    expect(chips.map((chip) => [chip.slug, chip.selected, chip.count])).toEqual([
      ["buying", false, 2],
      ["returns", true, 1],
      ["empty", false, 0],
    ]);
    expect(chips[0]?.href).toBe("/help?category=buying");
  });

  it("selects nothing without a slug", () => {
    expect(buildHelpCategoryChips(categories, null).some((chip) => chip.selected)).toBe(false);
  });
});

describe("groupHelpQuestions", () => {
  it("groups in category order and leaves out a category without questions", () => {
    const groups = groupHelpQuestions(categories, articles);
    expect(groups.map((group) => group.slug)).toEqual(["buying", "returns"]);
    expect(groups[0]?.questions).toEqual([
      { question: "Question pay?", href: "/help/pay" },
      { question: "Question framing?", href: "/help/framing" },
    ]);
  });

  it("is empty when nothing matches", () => {
    expect(groupHelpQuestions(categories, [])).toEqual([]);
  });
});

describe("buildHelpSearchResults", () => {
  it("carries the category so a result can be placed", () => {
    expect(buildHelpSearchResults([article("pay", "buying", "Buying")])).toEqual([
      { question: "Question pay?", href: "/help/pay", categoryTitle: "Buying" },
    ]);
  });
});

describe("helpResultsSummary", () => {
  it("covers none, one and many", () => {
    expect(helpResultsSummary("pay", 0)).toBe("No results for “pay”");
    expect(helpResultsSummary("pay", 1)).toBe("1 result for “pay”");
    expect(helpResultsSummary("pay", 4)).toBe("4 results for “pay”");
  });
});

describe("buildRelatedQuestions", () => {
  it("marks the question being read", () => {
    const related = buildRelatedQuestions(
      [article("pay", "buying", "Buying"), article("framing", "buying", "Buying")],
      "framing",
    );
    expect(related.map((question) => question.current)).toEqual([false, true]);
  });
});
