"use client";

import { BidHistoryDrawer } from "@/components/dashboard/bid-history-drawer";
import { ListEmpty, ListLoadError, ListNoResults } from "@/components/workspace/list-states";
import { useListQuery } from "@/components/workspace/use-list-query";
import {
  BIDS_SORTS,
  BIDS_SORT_LABEL,
  BIDS_VIEWS,
  BIDS_VIEW_LABEL,
  type BidsListQuery,
  type BidsSort,
  type BidsView as BidsViewId,
  appliedBidFilters,
  bidViewCounts,
  bidsInView,
  bidsListSearch,
  defaultBidsSort,
  isNarrowed,
} from "@/lib/bid/bids-list";
import type { MyBidCardVm, MyBidsVm } from "@/lib/bid/my-bids.vm";
import { buildRegistrationRows } from "@/lib/bid/registrations.vm";
import type { AccountRegistrationView } from "@/lib/data/http/account-buying.types";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { RecordList } from "@auction/ui";
import { ButtonLink, ListToolbar, ShowingCount, SortMenu, type TabNavItem } from "@auction/ui/lax";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BidRow } from "./bid-row";
import { BidsFilterSheet } from "./bids-filter-sheet";
import { MyBidsLiveUpdates } from "./my-bids-live-updates";
import { RegistrationRow } from "./registration-row";

export const BROWSE_UPCOMING_SALES_HREF = calendarSalesHref({ tab: "upcoming" });

export type BidsViewProps = {
  /** `null` when the bids could not be read. */
  vm: MyBidsVm | null;
  /** The sales the account asked to bid in; `null` when they could not be read. */
  registrations: readonly AccountRegistrationView[] | null;
  query: BidsListQuery;
  /** The account's name in sentences, or `null` for a person's own account. */
  organisation: string | null;
  /** Several members bid for the account, so rows and registrations name who did. */
  shared: boolean;
  /** The member may bid, so an empty list points to the sales. */
  offersSales: boolean;
  /** Why bidding is off for the account just now, shown on each bid step. */
  bidBlockedReason: string | null;
  userId: string | null;
};

const EMPTY_VIEW: Record<
  Exclude<BidsViewId, "sales">,
  (org: string | null) => {
    title: string;
    description: string;
  }
> = {
  active: () => ({
    title: "No open bids",
    description: "Lots bid on stay here until their sale closes.",
  }),
  won: (org) => ({
    title: "No wins yet",
    description: `Lots won${org ? ` for ${org}` : ""} appear here, and in Purchases for payment and delivery.`,
  }),
  lost: () => ({
    title: "Nothing missed",
    description: "Lots that close above the bid are listed here.",
  }),
};

function SalesFootnote() {
  return (
    <p className="text-lax-13 text-lax-muted">
      Registration is per sale. We check each request, usually within one working day.
    </p>
  );
}

/**
 * Bids for the account in use: the views (Active, Won, Not won and the Sales the account is
 * registered for) with search, filters, sort and the applied filters as chips. Everything is in
 * the address, so a view can be shared and the back button works.
 */
export function BidsView({
  vm,
  registrations,
  query: initialQuery,
  organisation,
  shared,
  offersSales,
  bidBlockedReason,
  userId,
}: BidsViewProps) {
  const { query, setQuery, search, setSearch } = useListQuery(initialQuery, bidsListSearch);
  const [filterOpen, setFilterOpen] = useState(false);
  const [history, setHistory] = useState<MyBidCardVm | null>(null);

  const counts = useMemo(() => (vm ? bidViewCounts(vm.cardsByTab, query) : null), [vm, query]);
  const totalBids = vm
    ? vm.cardsByTab.active.length + vm.cardsByTab.won.length + vm.cardsByTab.lost.length
    : 0;
  const registrationRows = useMemo(
    () =>
      registrations
        ? buildRegistrationRows(registrations, { showRegisteredBy: shared, query: query.q })
        : null,
    [registrations, shared, query.q],
  );

  const view = query.view;
  const tabs: TabNavItem[] = BIDS_VIEWS.map((id) => {
    const count =
      id === "sales" ? (registrationRows?.length ?? undefined) : (counts?.[id] ?? undefined);
    return {
      id,
      label: BIDS_VIEW_LABEL[id],
      href: `${CLIENT_ROUTES.bids}${bidsListSearch({ ...query, view: id, sort: defaultBidsSort(id) })}`,
      ...(count === undefined ? {} : { count }),
    };
  });
  const clearAll = () => setQuery({ ...query, q: "", sale: null, by: null, status: null });
  const chips = vm ? appliedBidFilters(query, vm.sales) : [];

  const toolbar = (
    <ListToolbar
      tabs={{ items: tabs, activeId: view, label: "Bids", Link }}
      search={{
        value: search,
        onValueChange: setSearch,
        placeholder: view === "sales" ? "Search by sale" : "Search by title, lot number or sale",
      }}
      {...(view === "sales"
        ? {}
        : {
            filter: { count: chips.length, open: filterOpen, onOpenChange: setFilterOpen },
            sort: (
              <SortMenu<BidsSort>
                value={query.sort}
                onValueChange={(sort) => setQuery({ ...query, sort })}
                options={BIDS_SORTS.map((value) => ({ value, label: BIDS_SORT_LABEL[value] }))}
              />
            ),
            chips: {
              filters: chips,
              onRemove: (id) => setQuery({ ...query, [id]: null }),
              onClearAll: clearAll,
            },
          })}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {toolbar}
      {view === "sales" ? (
        <SalesList
          rows={registrationRows}
          query={query.q}
          onClear={clearAll}
          offersSales={offersSales}
        />
      ) : !vm ? (
        <ListLoadError />
      ) : totalBids === 0 ? (
        <ListEmpty
          illustration="gavel"
          title="No bids yet"
          description={
            organisation
              ? `Live and upcoming bids for ${organisation} appear here.`
              : "Your live and upcoming bids appear here."
          }
          {...(offersSales
            ? {
                actions: (
                  <ButtonLink href={BROWSE_UPCOMING_SALES_HREF} Link={Link}>
                    Browse upcoming sales
                  </ButtonLink>
                ),
              }
            : {})}
        />
      ) : (
        <BidList
          cards={bidsInView(vm.cardsByTab[view], query)}
          total={vm.cardsByTab[view].length}
          query={query}
          organisation={organisation}
          onClear={clearAll}
          onOpenHistory={setHistory}
          bidBlockedReason={bidBlockedReason}
        />
      )}
      {vm ? (
        <BidsFilterSheet
          open={filterOpen}
          onOpenChange={setFilterOpen}
          query={query}
          onApply={setQuery}
          vm={vm}
          shared={shared}
        />
      ) : null}
      <BidHistoryDrawer
        open={history != null}
        lotId={history?.lotId ?? null}
        lotTitle={history?.title ?? ""}
        onOpenChange={(open) => {
          if (!open) setHistory(null);
        }}
      />
      {userId && vm ? <MyBidsLiveUpdates userId={userId} lots={vm.liveLots} /> : null}
    </div>
  );
}

function BidList({
  cards,
  total,
  query,
  organisation,
  onClear,
  onOpenHistory,
  bidBlockedReason,
}: {
  cards: MyBidCardVm[];
  total: number;
  query: BidsListQuery;
  organisation: string | null;
  onClear: () => void;
  onOpenHistory: (card: MyBidCardVm) => void;
  bidBlockedReason: string | null;
}) {
  if (cards.length === 0) {
    if (isNarrowed(query) && total > 0) return <ListNoResults query={query.q} onClear={onClear} />;
    const empty = EMPTY_VIEW[query.view as Exclude<BidsViewId, "sales">](organisation);
    return <ListEmpty illustration="gavel" title={empty.title} description={empty.description} />;
  }
  return (
    <>
      <RecordList aria-label={`${BIDS_VIEW_LABEL[query.view]} bids`}>
        {cards.map((card) => (
          <BidRow
            key={card.id}
            card={card}
            onOpenHistory={onOpenHistory}
            bidBlockedReason={bidBlockedReason}
          />
        ))}
      </RecordList>
      <ShowingCount shown={cards.length} total={cards.length} />
    </>
  );
}

function SalesList({
  rows,
  query,
  onClear,
  offersSales,
}: {
  rows: ReturnType<typeof buildRegistrationRows> | null;
  query: string;
  onClear: () => void;
  offersSales: boolean;
}) {
  if (!rows) return <ListLoadError />;
  if (rows.length === 0) {
    if (query) return <ListNoResults query={query} onClear={onClear} />;
    return (
      <ListEmpty
        illustration="gavel"
        title="No sale registrations"
        description="Register for a sale from its page to bid in it. We check each request, usually within one working day."
        {...(offersSales
          ? {
              actions: (
                <ButtonLink href={BROWSE_UPCOMING_SALES_HREF} Link={Link}>
                  Browse upcoming sales
                </ButtonLink>
              ),
            }
          : {})}
      />
    );
  }
  return (
    <>
      <RecordList aria-label="Sales registered for">
        {rows.map((row) => (
          <RegistrationRow key={row.id} row={row} />
        ))}
      </RecordList>
      <SalesFootnote />
    </>
  );
}
