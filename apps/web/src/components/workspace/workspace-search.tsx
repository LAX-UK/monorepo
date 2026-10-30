"use client";

import type { SearchRow } from "@/lib/workspace/account-search";
import {
  type AccountSearchPort,
  searchAccountRecords,
} from "@/lib/workspace/account-search.client";
import { type RecentSearchStore, localRecentSearchStore } from "@/lib/workspace/recent-searches";
import {
  type SearchPage,
  shouldSearchRecords,
  workspaceSearchView,
} from "@/lib/workspace/workspace-search-model";
import { cn } from "@auction/ui";
import {
  type PaletteGroup,
  SearchPalette,
  ShortcutKeys,
  useSearchPaletteShortcut,
} from "@auction/ui/lax";
import {
  FileText,
  Gavel,
  Image as ImageIcon,
  LayoutGrid,
  type LucideIcon,
  Package,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

const browserStore: RecentSearchStore = localRecentSearchStore(() =>
  typeof window === "undefined" ? null : window.localStorage,
);

const KIND_ICON: Record<SearchRow["kind"], ReactNode> = {
  consignments: <Package aria-hidden />,
  purchases: <ShoppingBag aria-hidden />,
  bids: <Gavel aria-hidden />,
  works: <ImageIcon aria-hidden />,
  invoices: <FileText aria-hidden />,
  members: <UserRound aria-hidden />,
  page: <LayoutGrid aria-hidden />,
};

type Status = "ready" | "loading" | "error";

/**
 * Search for the acting account: the field in the bar, ⌘K, Ctrl K or `/` opens the palette.
 * Before typing it offers the account's recent picks and the pages the role can open; after,
 * the records the API finds for this account and role, by group, then matching pages. A
 * narrower role is told what it does not search. Only the acting account is ever searched.
 */
export function WorkspaceSearch({
  accountId,
  accountName,
  roleLabel,
  pages,
  search = searchAccountRecords,
  recentStore = browserStore,
}: {
  accountId: string;
  accountName: string;
  /** The member's role, for the narrower-scope note: "Consignor". */
  roleLabel: string;
  /** The pages the role can open, each with its menu icon. */
  pages: readonly (SearchPage & { icon?: LucideIcon })[];
  search?: AccountSearchPort;
  recentStore?: RecentSearchStore;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<Awaited<ReturnType<AccountSearchPort>>>(null);
  const [status, setStatus] = useState<Status>("ready");
  const [recent, setRecent] = useState<SearchRow[]>([]);
  useSearchPaletteShortcut(() => setOpen(true));

  useEffect(() => {
    if (open) setRecent(recentStore.read(accountId));
  }, [open, accountId, recentStore]);

  useEffect(() => {
    if (!open || !shouldSearchRecords(query)) {
      setRecords(null);
      setStatus("ready");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    const timer = window.setTimeout(() => {
      search(query, controller.signal)
        .then((result) => {
          setRecords(result);
          setStatus(result ? "ready" : "error");
        })
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name === "AbortError") return;
          setRecords(null);
          setStatus("error");
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, search]);

  const view = useMemo(
    () => workspaceSearchView({ query, pages, recent, records, roleLabel }),
    [query, pages, recent, records, roleLabel],
  );
  const rowsById = useMemo(
    () => new Map(view.groups.flatMap((group) => group.rows.map((row) => [row.id, row]))),
    [view.groups],
  );
  const pageIcons = useMemo(
    () => new Map(pages.map((page) => [`page-${page.id}`, page.icon])),
    [pages],
  );
  const mediaFor = (row: SearchRow): ReactNode => {
    const Icon = pageIcons.get(row.id);
    return Icon ? <Icon aria-hidden /> : KIND_ICON[row.kind];
  };
  const groups: PaletteGroup[] = view.groups.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.rows.map((row) => ({
      id: row.id,
      label: row.label,
      ...(row.meta ? { meta: row.meta } : {}),
      media: mediaFor(row),
    })),
  }));
  const placeholder = `Search ${accountName}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K /"
        className={cn(
          "lax-focus hidden h-9 w-72 items-center gap-2 rounded-lax-control bg-lax-surface px-3 text-left text-lax-14 text-lax-muted",
          "shadow-[inset_0_0_0_1px_var(--lax-control-edge)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--lax-control-edge-hover)] lg:inline-flex",
        )}
      >
        <Search aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate">{placeholder}</span>
        <ShortcutKeys keys="mod+k" />
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={placeholder}
        className="lax-focus inline-flex size-11 items-center justify-center rounded-lax-control text-lax-fg hover:bg-lax-hover lg:hidden"
      >
        <Search aria-hidden className="size-5" strokeWidth={1.75} />
      </button>
      <SearchPalette
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        query={query}
        onQueryChange={setQuery}
        placeholder={placeholder}
        groups={groups}
        status={status}
        emptyState={{
          title: placeholder,
          description: "Find consignments, purchases, bids, works and pages.",
        }}
        {...(view.scopeNote ? { scopeNote: view.scopeNote } : {})}
        onSelect={(item) => {
          const row = rowsById.get(item.id);
          if (!row) return;
          if (row.kind !== "page") recentStore.remember(accountId, row);
          router.push(row.href);
        }}
      />
    </>
  );
}
