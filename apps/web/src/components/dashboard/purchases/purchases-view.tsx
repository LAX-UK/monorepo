"use client";

import { ListEmpty, ListLoadError, ListNoResults } from "@/components/workspace/list-states";
import { useListQuery } from "@/components/workspace/use-list-query";
import { COLLECT_LIST_COPY } from "@/lib/collect/collect-list-copy";
import { formatMoney } from "@/lib/format-currency";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { payHref } from "@/lib/pay/pay-links";
import { collectSelection } from "@/lib/purchases/purchase-collection";
import type { PurchaseTab } from "@/lib/purchases/purchase-progress";
import {
  PURCHASE_SORTS,
  PURCHASE_SORT_LABEL,
  PURCHASE_TABS,
  PURCHASE_TAB_LABEL,
  type PurchaseSort,
  type PurchasesListQuery,
  appliedPurchaseFilters,
  defaultPurchaseSort,
  isPurchaseListNarrowed,
  purchaseViewCounts,
  purchasesInView,
  purchasesListSearch,
} from "@/lib/purchases/purchases-list";
import type { PurchaseCardVm, PurchasesVm } from "@/lib/purchases/purchases.vm";
import { addMoneyStrings } from "@auction/domain";
import { RecordList } from "@auction/ui/components/record-row";
import { Button } from "@auction/ui/lax/button";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { Field } from "@auction/ui/lax/field";
import { FilterSheet, ListToolbar, ShowingCount, SortMenu } from "@auction/ui/lax/list-toolbar";
import { NativeSelect } from "@auction/ui/lax/native-select";
import { Notice } from "@auction/ui/lax/notice";
import type { TabNavItem } from "@auction/ui/lax/tabs";
import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { PurchaseRow } from "./purchase-row";

const EMPTY_VIEW: Record<
  PurchaseTab,
  (org: string | null) => { title: string; description: string }
> = {
  "to-pay": (org) => ({
    title: "Nothing to pay",
    description: `Invoices for lots won${org ? ` by ${org}` : ""} appear here.`,
  }),
  "in-progress": () => ({
    title: "Nothing on its way",
    description: "Paid lots stay here while we prepare them for collection or delivery.",
  }),
  completed: () => ({
    title: "Nothing completed yet",
    description: "Lots move here once they are delivered or collected.",
  }),
};

const ANY = "any";

/**
 * Purchases for the account in use: what is due with one payment for it, the views (To pay, In
 * progress, Completed) with search, filters and sort, and the invoices a payer picks to pay
 * together.
 */
export function PurchasesView({
  vm,
  query: initialQuery,
  organisation,
  offersSales,
}: {
  /** `null` when the purchases could not be read. */
  vm: PurchasesVm | null;
  query: PurchasesListQuery;
  organisation: string | null;
  offersSales: boolean;
}) {
  const { query, setQuery, search, setSearch } = useListQuery(initialQuery, purchasesListSearch);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState(query);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // What a pick let go of, said to assistive technology (the boxes and the bar show it).
  const [unpicked, setUnpicked] = useState("");
  const collectBarTextId = useId();
  useEffect(() => {
    if (filterOpen) setDraft(query);
  }, [filterOpen, query]);

  const cardsById = useMemo(
    () =>
      new Map(
        vm
          ? Object.values(vm.cardsByTab).flatMap((cards) => cards.map((c) => [c.lotId, c] as const))
          : [],
      ),
    [vm],
  );
  if (!vm) return <ListLoadError />;
  if (vm.total === 0) {
    return (
      <ListEmpty
        illustration="parcel"
        title="Nothing won yet"
        description={`Lots won${organisation ? ` for ${organisation}` : ""} appear here, from invoice to delivery.`}
        {...(offersSales
          ? {
              actions: (
                <ButtonLink href={calendarSalesHref({ tab: "upcoming" })} Link={Link}>
                  Browse upcoming sales
                </ButtonLink>
              ),
            }
          : {})}
      />
    );
  }

  const counts = purchaseViewCounts(vm.cardsByTab, query);
  const cards = purchasesInView(vm.cardsByTab[query.view], query);
  const tabs: TabNavItem[] = PURCHASE_TABS.map((id) => ({
    id,
    label: PURCHASE_TAB_LABEL[id],
    href: `${CLIENT_ROUTES.purchases}${purchasesListSearch({ ...query, view: id, sort: defaultPurchaseSort(id) })}`,
    count: counts[id],
    ...(id === "to-pay" && counts[id] > 0 ? { countTone: "attention" as const } : {}),
  }));
  const chips = appliedPurchaseFilters(query, vm.sales);
  const filterable = vm.sales.length > 1 || vm.winners.length > 1;
  const clearAll = () => setQuery({ ...query, q: "", sale: null, wonBy: null });
  const picks = [...selected].filter((id) => cardsById.get(id)?.payable);
  const picksTotal = picks.reduce(
    (sum, id) => addMoneyStrings(sum, cardsById.get(id)?.payable?.totalDue ?? "0"),
    "0.00",
  );
  const allCards = [...cardsById.values()];
  const collect = collectSelection(allCards, selected);
  // Paying and collecting are different errands: picking one kind lets go of the other, so the
  // one bar below always has one action. Letting go is said aloud, as it unticks other rows.
  const toggle = (card: PurchaseCardVm, on: boolean) => {
    const kept = [...selected].filter(
      (id) => !on || Boolean(cardsById.get(id)?.payable) === Boolean(card.payable),
    );
    const dropped = selected.size - kept.length;
    const next = new Set(kept);
    if (on) next.add(card.lotId);
    else next.delete(card.lotId);
    setSelected(next);
    setUnpicked(
      dropped === 0
        ? ""
        : card.payable
          ? COLLECT_LIST_COPY.bulk.clearedCollect(dropped)
          : COLLECT_LIST_COPY.bulk.clearedPay(dropped),
    );
  };
  const clearSelection = () => {
    setSelected(new Set());
    setUnpicked("");
  };
  const selectionFor = (card: PurchaseCardVm) => {
    const label = card.payable
      ? `Pay ${card.title}`
      : card.collectBy
        ? COLLECT_LIST_COPY.bulk.pick(card.title)
        : null;
    return label
      ? {
          selected: selected.has(card.lotId),
          onSelectedChange: (on: boolean) => toggle(card, on),
          label,
        }
      : null;
  };
  const empty = EMPTY_VIEW[query.view](organisation);

  return (
    <div className="flex flex-col gap-6">
      {vm.payNow?.kind === "pay" ? (
        <section
          aria-label="Due now"
          className="flex flex-col gap-4 rounded-lax-card border border-lax-line bg-lax-surface p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-lax-16 font-semibold tabular-nums text-lax-fg">{vm.payNow.title}</p>
            <p className="mt-1 text-lax-14 text-lax-muted">{vm.payNow.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {vm.payNow.documentsAction ? (
              <ButtonLink variant="secondary" href={vm.payNow.documentsAction.href}>
                {vm.payNow.documentsAction.label}
              </ButtonLink>
            ) : null}
            <ButtonLink
              // While invoices are picked, the selection bar holds the one primary action.
              variant={picks.length > 0 ? "secondary" : "primary"}
              Link={Link}
              href={payHref(vm.payNow.lotIds)}
            >
              Pay {formatMoney(vm.payNow.total)}
            </ButtonLink>
          </div>
        </section>
      ) : vm.payNow?.kind === "review" ? (
        <Notice
          tone="info"
          title={vm.payNow.title}
          actions={
            vm.payNow.documentsAction ? (
              <ButtonLink href={vm.payNow.documentsAction.href}>
                {vm.payNow.documentsAction.label}
              </ButtonLink>
            ) : undefined
          }
        >
          {vm.payNow.description}
        </Notice>
      ) : null}
      <div className="flex flex-col gap-4">
        <ListToolbar
          tabs={{ items: tabs, activeId: query.view, label: "Purchases", Link }}
          search={{
            value: search,
            onValueChange: setSearch,
            placeholder: "Search by title, lot number or sale",
          }}
          {...(filterable
            ? { filter: { count: chips.length, open: filterOpen, onOpenChange: setFilterOpen } }
            : {})}
          sort={
            <SortMenu<PurchaseSort>
              value={query.sort}
              onValueChange={(sort) => setQuery({ ...query, sort })}
              options={PURCHASE_SORTS.map((value) => ({
                value,
                label: PURCHASE_SORT_LABEL[value],
              }))}
            />
          }
          chips={{
            filters: chips,
            onRemove: (id) => setQuery({ ...query, [id]: null }),
            onClearAll: clearAll,
          }}
        />
        {cards.length === 0 ? (
          isPurchaseListNarrowed(query) ? (
            <ListNoResults query={query.q} onClear={clearAll} />
          ) : (
            <ListEmpty illustration="parcel" title={empty.title} description={empty.description} />
          )
        ) : (
          <>
            <RecordList aria-label={`${PURCHASE_TAB_LABEL[query.view]} purchases`}>
              {cards.map((card) => (
                <PurchaseRow
                  key={card.lotId}
                  card={card}
                  selectColumn={cards.some((each) => each.payable || each.collectBy)}
                  selection={selectionFor(card)}
                />
              ))}
            </RecordList>
            <ShowingCount shown={cards.length} total={cards.length} />
          </>
        )}
        {vm.truncated ? (
          <p className="text-lax-13 text-lax-muted">
            Showing your latest {vm.total} purchases. Older ones are settled and are not listed
            here.
          </p>
        ) : null}
        {organisation ? (
          <p className="text-lax-13 text-lax-muted">
            Owners, admins and finance can pay. Buyer agents see their own wins.
          </p>
        ) : null}
      </div>
      <output aria-live="polite" className="sr-only">
        {unpicked}
      </output>
      {picks.length > 0 ? (
        <section
          aria-label="Selected invoices"
          className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-lax-card border border-lax-line-strong bg-lax-surface p-3 shadow-lax-md sm:flex-row sm:items-center sm:justify-between max-lg:bottom-20"
        >
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear selection"
              onClick={clearSelection}
            >
              <X aria-hidden />
            </Button>
            <output
              aria-live="polite"
              className="block text-lax-14 font-medium tabular-nums text-lax-fg"
            >
              {picks.length} selected · {formatMoney(picksTotal)}
            </output>
          </div>
          <ButtonLink variant="primary" Link={Link} href={payHref(picks)}>
            Pay {picks.length === 1 ? "1 invoice" : `${picks.length} invoices`} ·{" "}
            {formatMoney(picksTotal)}
          </ButtonLink>
        </section>
      ) : null}
      {collect.kind !== "none" ? (
        <section
          aria-label="Selected lots to collect"
          className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-lax-card border border-lax-line-strong bg-lax-surface p-3 shadow-lax-md sm:flex-row sm:items-center sm:justify-between max-lg:bottom-20"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear selection"
              onClick={clearSelection}
            >
              <X aria-hidden />
            </Button>
            <output
              id={collectBarTextId}
              aria-live="polite"
              className="block text-lax-14 font-medium text-lax-fg"
            >
              {collect.kind === "ready"
                ? COLLECT_LIST_COPY.bulk.selected(collect.lotIds.length, collect.place)
                : collect.kind === "mixed_places"
                  ? COLLECT_LIST_COPY.bulk.mixed(collect.places)
                  : COLLECT_LIST_COPY.bulk.tooMany}
            </output>
          </div>
          {collect.kind === "ready" ? (
            <ButtonLink variant="primary" Link={Link} href={collect.href}>
              {COLLECT_LIST_COPY.bulk.button(collect.lotIds.length)}
            </ButtonLink>
          ) : (
            // Unavailable but focusable (`aria-disabled`, not `disabled`), and pointing at the
            // sentence that says why, so keyboard and screen reader users find the reason.
            <Button
              variant="primary"
              aria-disabled
              aria-describedby={collectBarTextId}
              className="cursor-not-allowed"
              onClick={(event) => event.preventDefault()}
            >
              {COLLECT_LIST_COPY.bulk.unavailable}
            </Button>
          )}
        </section>
      ) : null}
      {filterable ? (
        <FilterSheet
          open={filterOpen}
          onOpenChange={setFilterOpen}
          resultCount={purchasesInView(vm.cardsByTab[query.view], draft).length}
          onApply={() => setQuery(draft)}
          onClear={() => setDraft({ ...draft, sale: null, wonBy: null })}
        >
          {vm.sales.length > 1 ? (
            <Field label="Sale">
              <NativeSelect
                value={draft.sale ?? ANY}
                onValueChange={(value) =>
                  setDraft({ ...draft, sale: value === ANY ? null : value })
                }
                options={[
                  { value: ANY, label: "Any sale" },
                  ...vm.sales.map((s) => ({ value: s.id, label: s.title })),
                ]}
              />
            </Field>
          ) : null}
          {vm.winners.length > 1 ? (
            <Field label="Won by">
              <NativeSelect
                value={draft.wonBy ?? ANY}
                onValueChange={(value) =>
                  setDraft({ ...draft, wonBy: value === ANY ? null : value })
                }
                options={[
                  { value: ANY, label: "Anyone" },
                  ...vm.winners.map((name) => ({ value: name, label: name })),
                ]}
              />
            </Field>
          ) : null}
        </FilterSheet>
      ) : null}
    </div>
  );
}
