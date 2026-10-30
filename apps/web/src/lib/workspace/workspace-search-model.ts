import {
  ACCOUNT_SEARCH_MIN_LENGTH,
  type AccountSearchResult,
  type SearchRow,
  type SearchRowGroup,
  narrowerScopeNote,
  searchRowGroups,
} from "./account-search";

/** A page of the workspace the role can open, as the menu names it. */
export type SearchPage = { id: string; label: string; href: string };

const normalise = (text: string) => text.trim().toLowerCase();

/** The role's pages whose name contains the query; every page before anything is typed. */
export function matchingPages(pages: readonly SearchPage[], query: string): SearchRow[] {
  const q = normalise(query);
  return pages
    .filter((page) => !q || page.label.toLowerCase().includes(q))
    .map((page) => ({
      id: `page-${page.id}`,
      label: page.label,
      meta: "Page",
      href: page.href,
      kind: "page" as const,
    }));
}

/** Whether a query is long enough to ask the API (a lot reference like "12" also counts). */
export function shouldSearchRecords(query: string): boolean {
  const q = query.trim();
  return q.length >= ACCOUNT_SEARCH_MIN_LENGTH || /^#?\d+$/.test(q);
}

export type WorkspaceSearchView = {
  groups: SearchRowGroup[];
  /** What a narrower role does not search, shown under the results. */
  scopeNote: string | null;
};

/**
 * What the palette shows:
 * - before typing: the account's recent picks, then the pages the role can open ("Go to");
 * - after typing: the records found, by group, then the pages whose name matches.
 */
export function workspaceSearchView({
  query,
  pages,
  recent,
  records,
  roleLabel,
}: {
  query: string;
  pages: readonly SearchPage[];
  recent: readonly SearchRow[];
  records: AccountSearchResult | null;
  roleLabel: string;
}): WorkspaceSearchView {
  const typed = normalise(query).length > 0;
  const pageRows = matchingPages(pages, query);
  const groups: SearchRowGroup[] = typed
    ? [
        ...(records ? searchRowGroups(records) : []),
        ...(pageRows.length > 0 ? [{ id: "pages", label: "Pages", rows: pageRows }] : []),
      ]
    : [
        ...(recent.length > 0 ? [{ id: "recent", label: "Recent", rows: [...recent] }] : []),
        ...(pageRows.length > 0 ? [{ id: "pages", label: "Go to", rows: pageRows }] : []),
      ];
  return {
    groups,
    scopeNote: records ? narrowerScopeNote(records.searchable, roleLabel) : null,
  };
}
