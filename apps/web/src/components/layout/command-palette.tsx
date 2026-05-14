"use client";

import { PALETTE_OPEN_EVENT } from "@/components/layout/command-palette-events";
import { getStaffNavGroups } from "@/components/layout/staff-nav";
import type { SessionUser } from "@/lib/data/contracts";
import { showLiveBiddingNav } from "@/lib/feature-flags";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

export type PaletteItem = { id: string; href: string; label: string; hint?: string };
export type PaletteSection = { id: string; heading: string; items: PaletteItem[] };

const marketingSections: PaletteSection[] = [
  {
    id: "pages",
    heading: "Pages",
    items: [
      { id: "m-upcoming", href: "/", label: "Upcoming auctions", hint: "Home" },
      { id: "m-search", href: "/search", label: "Search lots" },
      { id: "m-archive", href: "/archive", label: "Past auctions" },
      { id: "m-artists", href: "/artists", label: "Browse artists" },
    ],
  },
];

const dashboardBuyingSections: PaletteSection[] = [
  {
    id: "pages",
    heading: "Pages",
    items: [
      { id: "d-home", href: "/dashboard", label: "Dashboard home" },
      { id: "d-portfolio", href: "/dashboard/portfolio", label: "My collection" },
      { id: "d-bids", href: "/dashboard/bids", label: "My bids" },
      { id: "d-watchlist", href: "/dashboard/watchlist", label: "Watchlist" },
      { id: "d-gallery", href: "/", label: "Browse gallery", hint: "Marketing site" },
      { id: "d-search", href: "/search", label: "Search lots" },
      { id: "d-live", href: "/dashboard/live/upcoming", label: "Live bidding", hint: "Saleroom" },
    ],
  },
];

const dashboardSellingSections: PaletteSection[] = [
  {
    id: "seller",
    heading: "Selling workspace",
    items: [
      { id: "s-overview", href: "/dashboard/seller", label: "Seller overview" },
      { id: "s-submissions", href: "/dashboard/submissions", label: "My submissions" },
      { id: "s-in-sale", href: "/dashboard/seller/in-sale", label: "Items in sale" },
      { id: "s-payouts", href: "/dashboard/seller/payouts", label: "Sold & payouts" },
      { id: "s-artist", href: "/dashboard/seller/artist", label: "Artist profile" },
      { id: "s-search", href: "/search", label: "Search lots" },
    ],
  },
];

function buildStaffAdminPaletteSections(
  sessionUser: SessionUser,
  pendingSubmissionCount: number,
  pendingArtistCount = 0,
): PaletteSection[] {
  const role = sessionUser.role as UserRole;
  const groups = getStaffNavGroups(
    role,
    pendingSubmissionCount,
    sessionUser.staffRole ?? null,
    pendingArtistCount,
  );
  const fromNav: PaletteSection[] = groups.map((g) => ({
    id: g.id,
    heading: g.title,
    items: g.items.map((it) => ({
      id: `sn-${it.id}`,
      href: it.href,
      label: it.label,
    })),
  }));
  const shortcuts: PaletteSection = {
    id: "shortcuts",
    heading: "Shortcuts",
    items: [
      { id: "sn-new-lot", href: "/admin/lots/new", label: "New lot" },
      { id: "sn-new-artist", href: "/admin/artists/new", label: "New artist" },
      ...(pendingArtistCount > 0
        ? [
            {
              id: "sn-pending-artists",
              href: "/admin/artists?status=pending",
              label: "Pending artists",
              hint: `${pendingArtistCount} pending`,
            } satisfies PaletteItem,
          ]
        : [
            {
              id: "sn-pending-artists",
              href: "/admin/artists?status=pending",
              label: "Pending artists",
            } satisfies PaletteItem,
          ]),
      { id: "sn-gallery", href: "/", label: "Exit to gallery", hint: "Marketing site" },
    ],
  };
  return [...fromNav, shortcuts];
}

function filterItems(items: PaletteItem[], query: string): PaletteItem[] {
  const t = query.trim().toLowerCase();
  if (!t) return items;
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(t) || (item.hint?.toLowerCase().includes(t) ?? false),
  );
}

function hideLiveBiddingItems(sections: PaletteSection[]): PaletteSection[] {
  if (showLiveBiddingNav()) return sections;
  return sections.map((sec) => ({
    ...sec,
    items: sec.items.filter((item) => item.id !== "d-live"),
  }));
}

function buildVisibleSections(
  variant: "marketing" | "dashboard" | "admin",
  query: string,
  sessionUser?: SessionUser | null,
  clientWorkspaceMode: ClientWorkspaceMode = "buying",
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
): PaletteSection[] {
  const base =
    variant === "dashboard"
      ? clientWorkspaceMode === "selling"
        ? dashboardSellingSections
        : hideLiveBiddingItems(dashboardBuyingSections)
      : variant === "admin" && sessionUser
        ? buildStaffAdminPaletteSections(sessionUser, pendingSubmissionCount, pendingArtistCount)
        : variant === "admin"
          ? []
          : marketingSections;
  const q = query.trim();
  const out: PaletteSection[] = [];
  for (const sec of base) {
    const items = filterItems(sec.items, query);
    if (items.length > 0) {
      out.push({ ...sec, items });
    }
  }
  if (q) {
    const actionItems: PaletteItem[] = [
      {
        id: "action-search-all",
        href: `/search?q=${encodeURIComponent(q)}`,
        label: `Search all lots for "${q}"`,
      },
    ];
    if (
      variant === "admin" &&
      sessionUser &&
      canAccessPlatformAdminRoutes(sessionUser.role as UserRole, sessionUser.staffRole ?? null)
    ) {
      actionItems.push(
        {
          id: "action-admin-lots-q",
          href: `/admin/lots?q=${encodeURIComponent(q)}`,
          label: `Lots list · title contains "${q}"`,
        },
        {
          id: "action-admin-artists-q",
          href: `/admin/artists?q=${encodeURIComponent(q)}`,
          label: `Artists · search "${q}"`,
        },
      );
      const maybeUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.exec(q);
      if (maybeUuid) {
        const id = maybeUuid[0];
        actionItems.push(
          {
            id: "action-open-lot",
            href: `/admin/lots/${id}`,
            label: `Open lot ${id}`,
            hint: "UUID",
          },
          {
            id: "action-publish-lot",
            href: `/admin/lots/${id}#publish`,
            label: `Lot detail (publish) · ${id.slice(0, 8)}…`,
          },
          {
            id: "action-open-submission",
            href: `/admin/submissions/${id}`,
            label: `Open submission ${id.slice(0, 8)}…`,
            hint: "UUID",
          },
          {
            id: "action-open-user",
            href: `/admin/users/${id}`,
            label: `Open user ${id.slice(0, 8)}…`,
            hint: "UUID",
          },
        );
      }
    }
    out.push({
      id: "actions",
      heading: "Actions",
      items: actionItems,
    });
  }
  return out;
}

function flattenItems(sections: PaletteSection[]): PaletteItem[] {
  return sections.flatMap((s) => s.items);
}

type Props = {
  variant: "marketing" | "dashboard" | "admin";
  /** When variant is admin, used to hide platform-only shortcuts for finance-only roles. */
  sessionUser?: SessionUser | null;
  clientWorkspaceMode?: ClientWorkspaceMode;
  /** Submission badge count for staff nav parity with sidebar (optional). */
  pendingSubmissionCount?: number;
  pendingArtistCount?: number;
};

export function CommandPalette({
  variant,
  sessionUser = null,
  clientWorkspaceMode = "buying",
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const titleId = useId();
  const listboxId = "palette-listbox";
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleSections = useMemo(
    () =>
      buildVisibleSections(
        variant,
        query,
        sessionUser,
        clientWorkspaceMode,
        pendingSubmissionCount,
        pendingArtistCount,
      ),
    [variant, query, sessionUser, clientWorkspaceMode, pendingSubmissionCount, pendingArtistCount],
  );
  const flatItems = useMemo(() => flattenItems(visibleSections), [visibleSections]);

  const close = useCallback(() => setOpen(false), []);

  const navigateTo = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onPaletteOpen = () => setOpen(true);
    window.addEventListener(PALETTE_OPEN_EVENT, onPaletteOpen);
    return () => window.removeEventListener(PALETTE_OPEN_EVENT, onPaletteOpen);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveId(null);
    }
  }, [open]);

  useEffect(() => {
    if (activeId && !flatItems.some((i) => i.id === activeId)) {
      setActiveId(null);
    }
  }, [activeId, flatItems]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) {
        el.showModal();
        queueMicrotask(() => inputRef.current?.focus());
      }
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  const onDialogClose = useCallback(() => {
    setOpen(false);
  }, []);

  const moveActive = useCallback(
    (delta: number) => {
      if (flatItems.length === 0) return;
      const currentIndex = activeId ? flatItems.findIndex((i) => i.id === activeId) : -1;
      const nextIndex =
        currentIndex < 0
          ? delta > 0
            ? 0
            : flatItems.length - 1
          : (currentIndex + delta + flatItems.length) % flatItems.length;
      setActiveId(flatItems[nextIndex]?.id ?? null);
    },
    [activeId, flatItems],
  );

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const active = activeId ? flatItems.find((i) => i.id === activeId) : undefined;
      if (active) {
        navigateTo(active.href);
        return;
      }
      const q = query.trim();
      if (q) {
        navigateTo(`/search?q=${encodeURIComponent(q)}`);
      }
    }
  };

  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[100] max-h-none max-w-none border-0 bg-transparent p-0 backdrop:bg-inverse-surface/40 backdrop:backdrop-blur-sm"
      aria-labelledby={titleId}
      onClose={onDialogClose}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="flex min-h-full items-start justify-center px-4 pt-[15vh]">
        <Button
          type="button"
          variant="ghost"
          className="fixed inset-0 h-auto cursor-default rounded-none px-0 py-0 hover:bg-transparent"
          tabIndex={-1}
          aria-hidden
          onClick={close}
        />
        <div className="relative z-10 w-full max-w-lg rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-2xl ring-1 ring-outline-variant/10">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-outline-variant/15 pb-3">
            <h2
              id={titleId}
              className="font-label text-xs font-bold uppercase tracking-widest text-secondary"
            >
              Quick go
            </h2>
            <span className="hidden font-mono text-xs text-on-surface-variant sm:inline">Esc</span>
          </div>
          <p className="mb-3 font-body text-sm text-on-surface-variant">
            Jump to a page. Open anytime with{" "}
            <kbd className="rounded border border-outline-variant/30 bg-surface-container-high px-1.5 py-0.5 font-mono text-xs">
              {isMac ? "⌘" : "Ctrl"}+K
            </kbd>
            .
          </p>
          <div className="mb-4">
            <label htmlFor="palette-query" className="sr-only">
              Search
            </label>
            <Input
              ref={inputRef}
              id="palette-query"
              type="search"
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={activeId ?? undefined}
              aria-autocomplete="list"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Filter pages or search lots…"
              className="h-auto min-h-11 w-full rounded-lg border border-outline-variant/25 bg-surface-container-high/60 py-2.5 font-body text-sm shadow-sm placeholder:text-on-surface-variant/70 focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <div
            id={listboxId}
            // biome-ignore lint/a11y/useSemanticElements: command palette listbox, not a native select
            role="listbox"
            tabIndex={-1}
            aria-label="Quick navigation results"
            className="max-h-[min(50vh,24rem)] space-y-4 overflow-y-auto"
          >
            {visibleSections.length === 0 ? (
              <p className="px-3 py-2 font-body text-sm text-on-surface-variant">No matches.</p>
            ) : (
              visibleSections.map((section) => (
                // biome-ignore lint/a11y/useSemanticElements: ARIA group for listbox sections, not a form fieldset
                <div key={section.id} role="group" aria-label={section.heading}>
                  <p
                    className="mb-1.5 px-1 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-on-surface-variant"
                    aria-hidden
                  >
                    {section.heading}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        id={item.id}
                        // biome-ignore lint/a11y/useSemanticElements: listbox option in dialog, not a native select option
                        role="option"
                        tabIndex={-1}
                        aria-selected={activeId === item.id}
                        onMouseEnter={() => setActiveId(item.id)}
                      >
                        <Link
                          href={item.href}
                          onClick={(e) => {
                            e.preventDefault();
                            navigateTo(item.href);
                          }}
                          className={`flex flex-col rounded-lg px-3 py-2.5 font-body text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                            activeId === item.id ? "bg-surface-container-high" : ""
                          }`}
                        >
                          <span>{item.label}</span>
                          {item.hint ? (
                            <span className="font-label text-xs uppercase tracking-wider text-on-surface-variant">
                              {item.hint}
                            </span>
                          ) : null}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
