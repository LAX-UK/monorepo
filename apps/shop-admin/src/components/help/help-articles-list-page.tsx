import { AdminFailedPage } from "@/components/admin-fetch-state";
import { HelpArticleTable } from "@/components/help/help-article-table.client";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import {
  type HelpArticleListSearch,
  type HelpStatusFilter,
  helpArticleListUrl,
  helpArticlesApiPath,
  isFilteredHelpArticleList,
  toHelpArticleListRow,
} from "@/server/domain/help-list.vm";
import type { HelpAdminArticleRow, HelpAdminCategoryRow } from "@auction/shop-contracts";
import { Button, EmptyState, EntityTableShell, FilterRow, Input, PageHeader } from "@auction/ui";
import Link from "next/link";
import { redirect } from "next/navigation";

const TITLE = "Help centre";

const STATUS_LABELS: Record<HelpStatusFilter, string> = {
  all: "All",
  published: "Published",
  draft: "Drafts",
};

function SearchForm({ search }: { search: HelpArticleListSearch }) {
  return (
    <form method="get" action="/help" className="flex items-center gap-2">
      {search.status !== "all" ? <Input type="hidden" name="status" value={search.status} /> : null}
      {search.categoryId ? <Input type="hidden" name="category" value={search.categoryId} /> : null}
      <Input
        type="search"
        name="q"
        defaultValue={search.q}
        aria-label="Search questions"
        placeholder="Search questions and answers"
        maxLength={120}
        className="min-w-64"
      />
      <Button type="submit" variant="outline">
        Search
      </Button>
      {search.q ? (
        <Button variant="link" asChild>
          <Link href={helpArticleListUrl({ ...search, q: "" })}>Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}

/**
 * Every question, narrowed by category, status and a search term. All three live in the URL and
 * are applied by the API, so a filtered view can be shared and the list never loads more than it
 * shows. Moving rows up and down is offered only on a whole category, where order is meaningful.
 */
export async function HelpArticlesListPage({ search }: { search: HelpArticleListSearch }) {
  const [articlesResult, categoriesResult] = await Promise.all([
    fetchAdminJson<{ items: HelpAdminArticleRow[] }>(helpArticlesApiPath(search)),
    fetchAdminJson<{ items: HelpAdminCategoryRow[] }>("help/categories"),
  ]);
  if (articlesResult.status === "unauthorized" || categoriesResult.status === "unauthorized") {
    redirect("/login");
  }
  if (articlesResult.status !== "ok") {
    return <AdminFailedPage title={TITLE} status={articlesResult.status} />;
  }
  if (categoriesResult.status !== "ok") {
    return <AdminFailedPage title={TITLE} status={categoriesResult.status} />;
  }

  const rows = articlesResult.data.items.map(toHelpArticleListRow);
  const categories = categoriesResult.data.items;
  const filtered = isFilteredHelpArticleList(search);
  const wholeCategory = Boolean(search.categoryId) && !search.q && search.status === "all";
  const newHref = search.categoryId ? `/help/new?category=${search.categoryId}` : "/help/new";

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <Link href="/help/categories">Categories</Link>
      </Button>
      <Button asChild>
        <Link href={newHref}>New question</Link>
      </Button>
    </div>
  );

  if (rows.length === 0 && !filtered) {
    return (
      <div>
        <PageHeader
          title={TITLE}
          description="Questions and answers shown on lax.art."
          actions={actions}
        />
        <EmptyState
          headingLevel="h2"
          title="No questions yet"
          description={
            categories.length === 0
              ? "Create a category first, then add questions to it."
              : "Add the first question as a draft, then publish it when it is ready."
          }
          action={
            categories.length === 0 ? (
              <Button asChild>
                <Link href="/help/categories">Create a category</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/help/new">New question</Link>
              </Button>
            )
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={TITLE}
        description="Questions and answers shown on lax.art."
        actions={actions}
      />
      <EntityTableShell
        responsiveMode="scroll"
        search={<SearchForm search={search} />}
        filters={
          <FilterRow
            mode="link"
            label="Filter questions by status"
            items={(["all", "published", "draft"] as const).map((status) => ({
              id: status,
              label: STATUS_LABELS[status],
              active: search.status === status,
              href: helpArticleListUrl({ ...search, status }),
            }))}
          />
        }
        table={
          <div className="space-y-4">
            <FilterRow
              mode="link"
              label="Filter questions by category"
              items={[
                {
                  id: "all-categories",
                  label: "All categories",
                  active: search.categoryId === null,
                  href: helpArticleListUrl({ ...search, categoryId: null }),
                },
                ...categories.map((category) => ({
                  id: category.id,
                  label: category.title,
                  active: search.categoryId === category.id,
                  href: helpArticleListUrl({ ...search, categoryId: category.id }),
                })),
              ]}
            />
            {rows.length === 0 ? (
              <EmptyState
                headingLevel="h2"
                title="No questions match"
                description="Try a different search, or show every category and status."
                action={
                  <Button variant="outline" asChild>
                    <Link href="/help">Clear search and filters</Link>
                  </Button>
                }
              />
            ) : (
              <HelpArticleTable
                rows={rows}
                reorderIn={wholeCategory ? search.categoryId : null}
                empty={{ title: "No questions", description: "Nothing to show." }}
              />
            )}
          </div>
        }
      />
    </div>
  );
}
