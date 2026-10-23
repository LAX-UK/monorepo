import type { HelpAdminArticleRow, HelpAdminCategoryRow } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  helpArticleListUrl,
  helpArticlesApiPath,
  isFilteredHelpArticleList,
  movedOrder,
  parseHelpArticleListSearch,
  toHelpArticleListRow,
  toHelpCategoryListRow,
} from "./help-list.vm";

const CATEGORY = "11111111-1111-4111-8111-111111111111";

describe("parseHelpArticleListSearch", () => {
  it("reads the term, status and category from the URL", () => {
    expect(
      parseHelpArticleListSearch({ q: "  deliver   abroad ", status: "draft", category: CATEGORY }),
    ).toEqual({ q: "deliver abroad", status: "draft", categoryId: CATEGORY });
  });

  it("falls back to defaults for anything unrecognised", () => {
    expect(parseHelpArticleListSearch({ status: "archived", category: "not-a-uuid" })).toEqual({
      q: "",
      status: "all",
      categoryId: null,
    });
  });

  it("takes the first of a repeated parameter and caps the term", () => {
    const search = parseHelpArticleListSearch({ q: ["a".repeat(200), "b"] });
    expect(search.q).toHaveLength(120);
  });
});

describe("list URLs", () => {
  it("leaves out defaults in the page address and puts every filter in the API path", () => {
    const search = { q: "pay", status: "published" as const, categoryId: CATEGORY };
    expect(helpArticleListUrl(search)).toBe(`/help?q=pay&status=published&category=${CATEGORY}`);
    expect(helpArticlesApiPath(search)).toBe(
      `help/articles?q=pay&status=published&categoryId=${CATEGORY}`,
    );
    const none = { q: "", status: "all" as const, categoryId: null };
    expect(helpArticleListUrl(none)).toBe("/help");
    expect(helpArticlesApiPath(none)).toBe("help/articles");
  });

  it("knows when a view is filtered", () => {
    expect(isFilteredHelpArticleList({ q: "", status: "all", categoryId: null })).toBe(false);
    expect(isFilteredHelpArticleList({ q: "", status: "draft", categoryId: null })).toBe(true);
    expect(isFilteredHelpArticleList({ q: "", status: "all", categoryId: CATEGORY })).toBe(true);
  });
});

describe("row mapping", () => {
  it("formats the update time in London", () => {
    const row: HelpAdminArticleRow = {
      id: "a",
      slug: "how-do-i-pay",
      question: "How do I pay?",
      categoryId: CATEGORY,
      categoryTitle: "Buying",
      position: 0,
      status: "draft",
      updatedAt: "2026-07-01T12:00:00.000Z",
      updatedBy: null,
    };
    expect(toHelpArticleListRow(row)).toMatchObject({
      question: "How do I pay?",
      categoryTitle: "Buying",
      updated: expect.stringContaining("13:00"),
    });
  });

  it("describes a category's questions, with the published count once it has any", () => {
    const base: HelpAdminCategoryRow = {
      id: "c",
      slug: "buying",
      title: "Buying",
      position: 0,
      status: "published",
      updatedAt: "2026-07-01T12:00:00.000Z",
      articleCount: 0,
      publishedArticleCount: 0,
    };
    expect(toHelpCategoryListRow(base).counts).toBe("0 questions");
    expect(toHelpCategoryListRow({ ...base, articleCount: 1 }).counts).toBe(
      "1 question, 0 published",
    );
    expect(
      toHelpCategoryListRow({ ...base, articleCount: 3, publishedArticleCount: 2 }).counts,
    ).toBe("3 questions, 2 published");
  });
});

describe("movedOrder", () => {
  const ids = ["a", "b", "c"];

  it("moves a row one place", () => {
    expect(movedOrder(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(movedOrder(ids, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("refuses to move past either end or an unknown row", () => {
    expect(movedOrder(ids, "a", "up")).toBeNull();
    expect(movedOrder(ids, "c", "down")).toBeNull();
    expect(movedOrder(ids, "z", "up")).toBeNull();
  });

  it("does not change the list it was given", () => {
    movedOrder(ids, "b", "up");
    expect(ids).toEqual(["a", "b", "c"]);
  });
});
