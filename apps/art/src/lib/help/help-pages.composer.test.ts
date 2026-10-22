import { fakeArtServices } from "@/lib/testing/fake-art-services";
import type { HelpArticleDetail, HelpArticleSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { composeHelpArticlePage, composeHelpIndexPage } from "./help-pages.composer";

const summary = (slug: string, categorySlug = "buying"): HelpArticleSummary => ({
  slug,
  question: `Question ${slug}?`,
  categorySlug,
  categoryTitle: categorySlug === "buying" ? "Buying" : "Returns",
});

const categories = {
  status: "ok" as const,
  data: {
    items: [
      { slug: "buying", title: "Buying", articleCount: 2 },
      { slug: "returns", title: "Returns", articleCount: 1 },
    ],
  },
};

function detail(overrides: Partial<HelpArticleDetail> = {}): HelpArticleDetail {
  return {
    ...summary("pay"),
    answer: [{ type: "richText", spans: [{ text: "By card." }] }],
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("composeHelpIndexPage", () => {
  it("browses every category's questions when nothing is selected", async () => {
    const services = fakeArtServices();
    services.help.listCategories.mockResolvedValue(categories);
    services.help.listArticles.mockResolvedValue({
      status: "ok",
      data: { items: [summary("pay"), summary("send-back", "returns"), summary("framing")] },
    });
    const result = await composeHelpIndexPage(services, { q: "", category: null });
    expect(services.help.listArticles).toHaveBeenCalledWith({});
    if (result.status !== "ok" || result.data.content.kind !== "browse") throw new Error("shape");
    expect(result.data.query).toBe("");
    expect(result.data.content.selectedTitle).toBeNull();
    expect(result.data.content.groups.map((group) => group.title)).toEqual(["Buying", "Returns"]);
  });

  it("narrows browsing to the selected category from the same read", async () => {
    const services = fakeArtServices();
    services.help.listCategories.mockResolvedValue(categories);
    services.help.listArticles.mockResolvedValue({
      status: "ok",
      data: { items: [summary("pay"), summary("send-back", "returns")] },
    });
    const result = await composeHelpIndexPage(services, { q: "", category: "returns" });
    if (result.status !== "ok" || result.data.content.kind !== "browse") throw new Error("shape");
    expect(result.data.content.selectedTitle).toBe("Returns");
    expect(result.data.content.groups.map((group) => group.slug)).toEqual(["returns"]);
    expect(result.data.categories.find((chip) => chip.selected)?.slug).toBe("returns");
  });

  it("shows everything for a category that does not exist", async () => {
    const services = fakeArtServices();
    services.help.listCategories.mockResolvedValue(categories);
    services.help.listArticles.mockResolvedValue({
      status: "ok",
      data: { items: [summary("pay")] },
    });
    const result = await composeHelpIndexPage(services, { q: "", category: "gone" });
    if (result.status !== "ok" || result.data.content.kind !== "browse") throw new Error("shape");
    expect(result.data.content.selectedTitle).toBeNull();
    expect(result.data.content.groups).toHaveLength(1);
  });

  it("searches across categories, ignoring a category filter", async () => {
    const services = fakeArtServices();
    services.help.listCategories.mockResolvedValue(categories);
    services.help.listArticles.mockResolvedValue({
      status: "ok",
      data: { items: [summary("pay")] },
    });
    const result = await composeHelpIndexPage(services, { q: "pay", category: "returns" });
    expect(services.help.listArticles).toHaveBeenCalledWith({ q: "pay" });
    expect(result).toMatchObject({
      status: "ok",
      data: {
        query: "pay",
        content: {
          kind: "search",
          summary: "1 result for “pay”",
          results: [{ question: "Question pay?", href: "/help/pay", categoryTitle: "Buying" }],
        },
      },
    });
  });

  it("reports no results as an empty search, not an error", async () => {
    const services = fakeArtServices();
    services.help.listCategories.mockResolvedValue(categories);
    services.help.listArticles.mockResolvedValue({ status: "ok", data: { items: [] } });
    const result = await composeHelpIndexPage(services, { q: "zzz", category: null });
    expect(result).toMatchObject({
      status: "ok",
      data: { content: { kind: "search", summary: "No results for “zzz”", results: [] } },
    });
  });

  it("passes a failed or disabled read through", async () => {
    const services = fakeArtServices();
    expect(await composeHelpIndexPage(services, { q: "", category: null })).toEqual({
      status: "disabled",
    });
    services.help.listCategories.mockResolvedValue(categories);
    services.help.listArticles.mockResolvedValue({ status: "error" });
    expect(await composeHelpIndexPage(services, { q: "", category: null })).toEqual({
      status: "error",
    });
  });
});

describe("composeHelpArticlePage", () => {
  it("reads the answer and the rest of its category, marking the current question", async () => {
    const services = fakeArtServices();
    services.help.getArticle.mockResolvedValue({ status: "ok", data: detail() });
    services.help.listArticles.mockResolvedValue({
      status: "ok",
      data: { items: [summary("pay"), summary("framing")] },
    });
    const result = await composeHelpArticlePage(services, "pay");
    expect(services.help.listArticles).toHaveBeenCalledWith({ categorySlug: "buying" });
    expect(result).toMatchObject({
      status: "ok",
      data: {
        path: "/help/pay",
        categoryHref: "/help?category=buying",
        related: [
          { href: "/help/pay", current: true },
          { href: "/help/framing", current: false },
        ],
      },
    });
  });

  it("hides the side list when the question is alone in its category", async () => {
    const services = fakeArtServices();
    services.help.getArticle.mockResolvedValue({ status: "ok", data: detail() });
    services.help.listArticles.mockResolvedValue({
      status: "ok",
      data: { items: [summary("pay")] },
    });
    const result = await composeHelpArticlePage(services, "pay");
    expect(result).toMatchObject({ status: "ok", data: { related: [] } });
  });

  it("still shows the answer when the related read fails", async () => {
    const services = fakeArtServices();
    services.help.getArticle.mockResolvedValue({ status: "ok", data: detail() });
    services.help.listArticles.mockResolvedValue({ status: "error" });
    const result = await composeHelpArticlePage(services, "pay");
    expect(result).toMatchObject({ status: "ok", data: { related: [] } });
  });

  it("passes not_found through so the route can 404", async () => {
    const services = fakeArtServices();
    services.help.getArticle.mockResolvedValue({ status: "not_found" });
    expect(await composeHelpArticlePage(services, "gone")).toEqual({ status: "not_found" });
    expect(services.help.listArticles).not.toHaveBeenCalled();
  });
});
