"use client";

import { BulkLinkDialog } from "@/components/from-zoho/bulk-link-dialog.client";
import {
  choiceColumns,
  linkedColumns,
  matchedColumns,
  noMatchColumns,
} from "@/components/from-zoho/link-report-columns.client";
import {
  type LinkSuggestion,
  LinkToZohoDialog,
} from "@/components/from-zoho/link-to-zoho-dialog.client";
import {
  FROM_ZOHO_DESCRIPTION,
  FROM_ZOHO_TITLE,
  useQueueFrame,
} from "@/components/from-zoho/use-queue-frame.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  getZohoLinkReport,
  setBlockUnlinkedPublish,
} from "@/server/application/admin-zoho-link-actions.server";
import {
  LINK_ON_FILTER_OPTIONS,
  LINK_RULE_FILTER_OPTIONS,
  LINK_SORT_OPTIONS,
  LINK_VIEWS,
  LINK_VIEW_LABEL,
  activeLinkView,
  artistOptions,
  hasActiveLinkFilters,
  linkViewCounts,
  narrowLinked,
  narrowRows,
  pageOf,
} from "@/server/domain/zoho-link-list.vm";
import {
  type ZohoLinkRule,
  type ZohoLinkView,
  type ZohoQueueQuery,
  pageLinks,
  pageSummary,
  zohoQueueHref,
} from "@/server/domain/zoho-register.vm";
import type {
  AdminZohoLinkCandidate,
  AdminZohoLinkReport,
  AdminZohoLinkRow,
  AdminZohoLinkedRow,
} from "@auction/shop-contracts";
import {
  FilterSheet,
  ListPage,
  Notice,
  type OverflowAction,
  SegmentedControl,
  SortMenu,
  StaffButton,
  StaffSwitch,
  StatGrid,
  TableSearch,
  formatStaffDateTime,
  toast,
  useStaffAccess,
} from "@auction/staff-ui";
import { ArrowUpRight, Link2, RefreshCw, Search } from "@auction/staff-ui/icons";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Review = { row: AdminZohoLinkRow; registerId: string | null };

const SEGMENT_ORDER: readonly ZohoLinkView[] = LINK_VIEWS;
const PAGE_LABEL = { prevLabel: "Previous page" } as const;

const EMPTY: Record<ZohoLinkView, { title: string; description: string }> = {
  matched: {
    title: "Nothing is matched",
    description: "Rows the report matches to one Zoho record appear here, ready to confirm.",
  },
  choice: {
    title: "Nothing needs a choice",
    description: "Rows with several possible records, or one that cannot be used, appear here.",
  },
  none: {
    title: "Every artwork has a match",
    description: "Rows with no matching Zoho record appear here.",
  },
  linked: {
    title: "Nothing is linked yet",
    description: "Artworks linked from this report appear here, with who linked them.",
  },
};

const DONE = {
  title: "Every lax.art original is linked to Zoho",
  description:
    "The one-place lock and moves now cover every original on lax.art. This tab is hidden until a new original needs linking.",
};

/**
 * One-off: every lax.art original that is not linked to a register record, matched to Zoho, on the
 * staff list template. A control picks Matched, Needs a choice, No match or Linked. Nothing is
 * linked on its own: staff select Matched rows and confirm them together, or review any row one at
 * a time, after seeing what Zoho's details will change. "Check again" matches again after Zoho is
 * fixed; matching only reads.
 */
export function LinkLaxArtReport({
  query,
  counts,
  report: initial,
}: {
  query: ZohoQueueQuery;
  counts: { new: number; decisions: number };
  report: AdminZohoLinkReport;
}) {
  const router = useRouter();
  const access = useStaffAccess();
  const canLink = access.can("catalogue.write") && access.can("artwork_register.review");
  const canSwitch = access.can("settings.write");
  const [report, setReport] = useState(initial);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [finding, setFinding] = useState<AdminZohoLinkRow | null>(null);
  const [bulkRows, setBulkRows] = useState<readonly AdminZohoLinkRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { pending, navigate, ListLink, views } = useQueueFrame(
    query,
    counts,
    report.counts.unlinked,
  );
  const view = activeLinkView(query);

  useEffect(() => setReport(initial), [initial]);

  async function checkAgain() {
    setChecking(true);
    setCheckError(null);
    const result = await getZohoLinkReport().catch(() => null);
    setChecking(false);
    if (result?.ok) {
      setReport(result.data);
      router.refresh();
      return;
    }
    setCheckError(
      result ? adminMutationErrorMessage(result) : "Could not check again. Try again in a moment.",
    );
  }

  async function toggleSwitch(next: boolean) {
    setSwitching(true);
    const result = await setBlockUnlinkedPublish(next).catch(() => null);
    setSwitching(false);
    if (result?.ok) {
      setReport((current) => ({
        ...current,
        blockUnlinkedPublish: result.data.blockUnlinkedPublish,
      }));
      toast.success(
        result.data.blockUnlinkedPublish
          ? "Unlinked originals can no longer be published"
          : "Unlinked originals can be published again",
      );
      return;
    }
    toast.error(
      result ? adminMutationErrorMessage(result) : "Could not change the setting. Try again.",
    );
  }

  function afterLink() {
    setSelected(new Set());
    setAllMatching(false);
    void checkAgain();
  }

  const viewCounts = linkViewCounts(report);
  const total = report.counts.unlinked + report.counts.linked;
  const done = report.counts.unlinked === 0;

  // The rows of the part being looked at: the Linked part has its own shape, the others share one.
  const unlinkedRows: readonly AdminZohoLinkRow[] =
    view === "matched"
      ? report.matched
      : view === "choice"
        ? report.needsChoice
        : view === "none"
          ? report.noMatch
          : [];
  const rows = useMemo(() => narrowRows(unlinkedRows, query), [unlinkedRows, query]);
  const linkedRows = useMemo(
    () => (view === "linked" ? narrowLinked(report.linked, query) : []),
    [report.linked, view, query],
  );
  const page = pageOf(rows, query);
  const linkedPage = pageOf(linkedRows, query);
  const footer = view === "linked" ? linkedPage : page;
  const links = pageLinks(query, footer);
  const everyListing = view === "linked" ? report.linked : unlinkedRows;
  const filtered = hasActiveLinkFilters(query);

  const go = useCallback(
    (change: Parameters<typeof zohoQueueHref>[1]) => navigate(zohoQueueHref(query, change)),
    [navigate, query],
  );

  const openArtwork = useCallback(
    (artworkId: string): OverflowAction => ({
      id: "open-artwork",
      label: "Open artwork",
      icon: ArrowUpRight,
      onSelect: () => navigate(`/artworks/${artworkId}`),
    }),
    [navigate],
  );

  const stats = (
    <StatGrid
      label="Link lax.art"
      period={
        <>
          Checked {formatStaffDateTime(report.checkedAt)}. Nothing is linked until you confirm.
          Where lax.art and Zoho disagree, Zoho's value replaces lax.art's; web addresses never
          change.
        </>
      }
      items={[
        {
          id: "matched",
          label: "Matched",
          value: String(report.counts.matched),
          hint: "ready to confirm",
        },
        { id: "choice", label: "Needs a choice", value: String(report.counts.needsChoice) },
        { id: "none", label: "No match", value: String(report.counts.noMatch) },
        { id: "linked", label: "Linked", value: String(report.counts.linked), hint: `of ${total}` },
      ]}
    />
  );

  const notice = (
    <div className="flex flex-col gap-4">
      {checkError ? (
        <Notice tone="danger" alert title="Could not check again">
          {checkError}
        </Notice>
      ) : null}
      {stats}
      <section
        aria-label="Publishing unlinked originals"
        className="flex flex-wrap items-center justify-between gap-3 rounded-staff-lg border border-staff-line bg-staff-surface px-4 py-3"
      >
        <div className="min-w-0">
          <h2 className="text-staff-sm font-semibold text-staff-fg">
            Block publishing unlinked originals
          </h2>
          <p className="text-staff-xs text-staff-muted">
            {report.blockUnlinkedPublish
              ? "On. An original that is not linked to Zoho cannot be published."
              : "Off. Turn it on once this report is done."}
            {canSwitch ? "" : " Only an Administrator can change it."}
          </p>
        </div>
        <StaffSwitch
          aria-label="Block publishing unlinked originals"
          checked={report.blockUnlinkedPublish}
          disabled={!canSwitch || switching}
          onCheckedChange={(next: boolean) => void toggleSwitch(next)}
        />
      </section>
    </div>
  );

  const segments = (
    <div className="overflow-x-auto px-3 pt-1 pb-2.5 [scrollbar-width:none]">
      <SegmentedControl<ZohoLinkView>
        className="w-max"
        label="Part of the report"
        value={view}
        onValueChange={(next) =>
          go({ view: next === "matched" ? null : next, matched: null, artist: null })
        }
        options={SEGMENT_ORDER.map((id) => ({
          value: id,
          label: `${LINK_VIEW_LABEL[id]} ${viewCounts[id]}`,
        }))}
      />
    </div>
  );

  const artistChoices = artistOptions(everyListing.map((item) => item.listing));
  const sections = [
    {
      kind: "radio" as const,
      id: "artist",
      label: "Artist",
      anyLabel: "Any artist",
      options: artistChoices,
      value: query.artist ?? "",
    },
    ...(view === "matched"
      ? [
          {
            kind: "radio" as const,
            id: "matched",
            label: "Matched on",
            anyLabel: "Anything",
            options: LINK_RULE_FILTER_OPTIONS,
            value: query.matched ?? "",
          },
        ]
      : []),
    {
      kind: "radio" as const,
      id: "on",
      label: "On lax.art",
      anyLabel: "Live or draft",
      options: LINK_ON_FILTER_OPTIONS,
      value: query.on ?? "",
    },
  ];
  const activeFilters = [
    ...(query.artist
      ? [{ id: "artist", label: `Artist: ${query.artist}`, onRemove: () => go({ artist: null }) }]
      : []),
    ...(query.matched
      ? [
          {
            id: "matched",
            label: `Matched on: ${LINK_RULE_FILTER_OPTIONS.find((o) => o.value === query.matched)?.label.toLowerCase() ?? query.matched}`,
            onRemove: () => go({ matched: null }),
          },
        ]
      : []),
    ...(query.on
      ? [
          {
            id: "on",
            label: query.on === "live" ? "Live on lax.art" : "Draft on lax.art",
            onRemove: () => go({ on: null }),
          },
        ]
      : []),
  ];

  const frame = {
    title: FROM_ZOHO_TITLE,
    description: FROM_ZOHO_DESCRIPTION,
    Link: ListLink,
    listKey: `from-zoho-link-${view}`,
    access: canLink ? ("full" as const) : ("read-only" as const),
    secondaryActions: (
      <StaffButton
        variant="secondary"
        icon={<RefreshCw aria-hidden />}
        loading={checking}
        onClick={() => void checkAgain()}
      >
        Check again
      </StaffButton>
    ),
    notice,
    views: (
      <div className="flex flex-col">
        {views}
        {segments}
      </div>
    ),
    search: (
      <TableSearch
        key={query.q ?? ""}
        fullWidth
        label="Search the report"
        placeholder="Title, artist or stock code"
        value={query.q ?? ""}
        onSearch={(q) => go({ q: q.trim() || null })}
      />
    ),
    filters: (
      <FilterSheet
        title="Filter the report"
        sections={sections}
        onApply={(values) =>
          go({
            artist: (values.artist as string) || null,
            matched: ((values.matched as ZohoLinkRule | undefined) ?? query.matched) || null,
            on: ((values.on as "live" | "draft" | "") || null) as "live" | "draft" | null,
          })
        }
      />
    ),
    period: (
      <SortMenu
        value={query.sort ?? "title"}
        options={LINK_SORT_OPTIONS}
        onChange={(next) => go({ sort: next === "artist" ? "artist" : null })}
      />
    ),
    activeFilters,
    onClearFilters: () => go({ q: null, artist: null, matched: null, on: null }),
    loading: pending,
    filtered,
    empty: {
      illustration: "plinth" as const,
      ...(done && view !== "linked" ? DONE : EMPTY[view]),
    },
    noResults: { noun: "artworks" },
    pagination:
      footer.items.length > 0 ? { summary: pageSummary(footer), ...PAGE_LABEL, ...links } : null,
  };

  const reviewDialog = review ? (
    <LinkToZohoDialog
      key={`${review.row.listing.artworkId}:${review.registerId ?? ""}`}
      open
      onOpenChange={(open) => {
        if (!open) setReview(null);
      }}
      artworkId={review.row.listing.artworkId}
      subtitle={listingSubtitle(review.row.listing)}
      published={review.row.listing.published}
      suggestions={review.row.candidates.map(
        (candidate): LinkSuggestion => ({ candidate, rule: review.row.rule }),
      )}
      initialRegisterId={review.registerId}
      onLinked={afterLink}
    />
  ) : null;
  const findDialog = finding ? (
    <LinkToZohoDialog
      key={finding.listing.artworkId}
      open
      onOpenChange={(open) => {
        if (!open) setFinding(null);
      }}
      artworkId={finding.listing.artworkId}
      subtitle={listingSubtitle(finding.listing)}
      published={finding.listing.published}
      onLinked={afterLink}
    />
  ) : null;
  const bulkDialog = bulkRows ? (
    <BulkLinkDialog
      open
      onOpenChange={(open) => {
        if (!open) setBulkRows(null);
      }}
      matched={bulkRows}
      onDone={afterLink}
    />
  ) : null;

  const reviewRow = (row: AdminZohoLinkRow, registerId: string | null = null) =>
    setReview({ row, registerId });

  return (
    <>
      {view === "matched" ? (
        <ListPage<AdminZohoLinkRow>
          {...frame}
          table={{
            columns: matchedColumns(),
            data: page.items,
            getRowId: (row) => row.listing.artworkId,
            defaultDensity: "comfortable",
            onRowOpen: (row) =>
              canLink ? reviewRow(row) : navigate(`/artworks/${row.listing.artworkId}`),
            rowActions: {
              label: (row) => `Actions for ${row.listing.title}`,
              actions: (row) => [
                ...(canLink
                  ? [
                      {
                        id: "review",
                        label: "Review and link…",
                        icon: Link2,
                        onSelect: () => reviewRow(row),
                      },
                    ]
                  : []),
                openArtwork(row.listing.artworkId),
              ],
            },
            selectedIds: selected,
            onSelectedIdsChange: setSelected,
            bulkNoun: { one: "listing", other: "listings" },
            selectAllMatching: {
              total: rows.length,
              active: allMatching,
              onActiveChange: setAllMatching,
            },
            bulkActions: (picked, scope) => (
              <StaffButton
                size="sm"
                variant="primary"
                icon={<Link2 aria-hidden />}
                onClick={() => setBulkRows(scope.allMatching ? rows : picked)}
              >
                Link {scope.count}…
              </StaffButton>
            ),
          }}
        />
      ) : view === "choice" ? (
        <ListPage<AdminZohoLinkRow>
          {...frame}
          table={{
            columns: choiceColumns({
              canLink,
              onChoose: (row, candidate: AdminZohoLinkCandidate) =>
                reviewRow(row, candidate.record.registerId),
            }),
            data: page.items,
            getRowId: (row) => row.listing.artworkId,
            defaultDensity: "comfortable",
            rowActions: {
              label: (row) => `Actions for ${row.listing.title}`,
              actions: (row) => [openArtwork(row.listing.artworkId)],
            },
          }}
        />
      ) : view === "none" ? (
        <ListPage<AdminZohoLinkRow>
          {...frame}
          table={{
            columns: noMatchColumns({ canLink, onFind: setFinding }),
            data: page.items,
            getRowId: (row) => row.listing.artworkId,
            defaultDensity: "comfortable",
            rowActions: {
              label: (row) => `Actions for ${row.listing.title}`,
              actions: (row) => [
                ...(canLink
                  ? [
                      {
                        id: "find",
                        label: "Find in Zoho…",
                        icon: Search,
                        onSelect: () => setFinding(row),
                      },
                    ]
                  : []),
                openArtwork(row.listing.artworkId),
              ],
            },
          }}
        />
      ) : (
        <ListPage<AdminZohoLinkedRow>
          {...frame}
          table={{
            columns: linkedColumns(),
            data: linkedPage.items,
            getRowId: (row) => row.listing.artworkId,
            defaultDensity: "comfortable",
            onRowOpen: (row) => navigate(`/artworks/${row.listing.artworkId}`),
            rowActions: {
              label: (row) => `Actions for ${row.listing.title}`,
              actions: (row) => [openArtwork(row.listing.artworkId)],
            },
          }}
        />
      )}
      {reviewDialog}
      {findDialog}
      {bulkDialog}
    </>
  );
}

function listingSubtitle(listing: AdminZohoLinkRow["listing"]): string {
  return `${listing.title} · ${listing.artistName} · ${listing.published ? "Live on lax.art" : "Draft on lax.art"}`;
}
