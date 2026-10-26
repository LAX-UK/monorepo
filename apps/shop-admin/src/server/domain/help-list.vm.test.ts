import type { HelpAdminArticleRow, HelpAdminCategoryRow } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  helpArticlesApiPath,
  helpArticlesList,
  inView,
  movedOrder,
  parseHelpArticlesState,
  parseHelpCategoriesState,
  statusCounts,
  toHelpArticleListRow,
  toHelpCategoryListRow,
} from "./help-list.vm";

const CATEGORY = "11111111-1111-4111-8111-111111111111";

describe("parseHelpArticlesState", () => {
  it("reads the term, view, category and open question from the URL", () => {
    expect(
      parseHelpArticlesState({
        q: "deliver abroad",
        view: "draft",
        category: CATEGORY,
        article: "a1",
      }),
    ).toEqual({
      view: "draft",
      q: "deliver abroad",
      filters: { category: CATEGORY },
      open: "a1",
    });
  });

  it("falls back to defaults for anything unrecognised", () => {
    expect(parseHelpArticlesState({ view: "archived", category: "not-a-uuid" })).toEqual({
      view: "all",
      filters: {},
    });
  });

  it("takes the first of a repeated parameter and caps the term", () => {
    expect(parseHelpArticlesState({ q: ["a".repeat(200), "b"] }).q).toHaveLength(120);
  });

  it("never carries a sort: the order is the manual position", () => {
    expect(parseHelpArticlesState({ sort: "created_desc" }).sort).toBeUndefined();
    expect(helpArticlesList.defaultSortState().columnId).toBe("position");
  });
});

describe("list URLs", () => {
  it("leaves defaults out of the page address and puts the search and category in the API path", () => {
    const state = parseHelpArticlesState({ q: "pay", view: "published", category: CATEGORY });
    expect(helpArticlesList.href(state)).toBe(`/help?view=published&q=pay&category=${CATEGORY}`);
    // The view is applied on the page so every view can be counted.
    expect(helpArticlesApiPath(state)).toBe(`help/articles?q=pay&categoryId=${CATEGORY}`);
    const none = parseHelpArticlesState({});
    expect(helpArticlesList.href(none)).toBe("/help");
    expect(helpArticlesApiPath(none)).toBe("help/articles");
  });

  it("opens a question in the panel with ?article=", () => {
    expect(helpArticlesList.panelHref(parseHelpArticlesState({}), "a1")).toBe("/help?article=a1");
  });

  it("opens a category in the panel with ?category=", () => {
    const state = parseHelpCategoriesState({ category: "c1", view: "draft" });
    expect(state.open).toBe("c1");
  });
});

describe("views", () => {
  const rows = [{ status: "published" }, { status: "draft" }, { status: "published" }];

  it("counts rows per status and filters them by view", () => {
    expect(statusCounts(rows)).toEqual({ published: 2, draft: 1 });
    expect(inView(rows, "all")).toHaveLength(3);
    expect(inView(rows, "published")).toHaveLength(2);
    expect(inView(rows, "draft")).toHaveLength(1);
  });

  it("adds the counts up per view", () => {
    const views = helpArticlesList.views(parseHelpArticlesState({}), statusCounts(rows));
    expect(views.map((view) => [view.label, view.count])).toEqual([
      ["All", 3],
      ["Published", 2],
      ["Drafts", 1],
    ]);
  });
});

describe("row mapping", () => {
  it("keeps the update time as sent, for the list to format in London", () => {
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
      categoryId: CATEGORY,
      updatedAt: "2026-07-01T12:00:00.000Z",
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
