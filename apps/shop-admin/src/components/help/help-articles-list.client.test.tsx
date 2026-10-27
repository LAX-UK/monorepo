// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/help",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/server/application/admin-help-actions.server", () => ({
  saveHelpCategory: vi.fn(),
  setHelpArticlePublication: vi.fn(),
  deleteHelpArticle: vi.fn(),
  reorderHelpArticles: vi.fn(),
}));

const { HelpArticlesList } = await import("./help-articles-list.client");
const { parseHelpArticlesState } = await import("@/server/domain/help-list.vm");

function renderList(categories: { id: string; title: string }[]) {
  render(
    <HelpArticlesList
      state={parseHelpArticlesState({})}
      rows={[]}
      counts={{ published: 0, draft: 0 }}
      categories={categories}
      artPublicUrl={null}
    />,
  );
}

describe("HelpArticlesList with no questions", () => {
  afterEach(cleanup);

  it("offers New category once, in the empty state, when there are no categories", () => {
    renderList([]);
    expect(screen.getByText("Create a category first")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "New category" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "New question" })).not.toBeInTheDocument();
  });

  it("offers New question once, in the empty state, when categories exist", () => {
    renderList([{ id: "c-1", title: "Buying" }]);
    expect(screen.getAllByRole("link", { name: "New question" })).toHaveLength(1);
  });
});
