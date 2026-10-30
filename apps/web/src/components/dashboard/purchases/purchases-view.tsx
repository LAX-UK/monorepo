"use client";

import { ListEmpty, ListLoadError, ListNoResults } from "@/components/workspace/list-states";
import { useListQuery } from "@/components/workspace/use-list-query";
import { formatMoney } from "@/lib/format-currency";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
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
import { RecordList } from "@auction/ui";
import {
  Button,
  ButtonLink,
  Field,
  FilterSheet,
  ListToolbar,
  NativeSelect,
  Notice,
  ShowingCount,
  SortMenu,
  type TabNavItem,
} from "@auction/ui/lax";
import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PaySeveralDialog } from "./pay-several-dialog";
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
  const [paying, setPaying] = useState<readonly string[] | null>(null);
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
  const toggle = (card: PurchaseCardVm, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(card.lotId);
      else next.delete(card.lotId);
      return next;
    });
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
          <Button
            // While invoices are picked, the selection bar holds the one primary action.
            variant={picks.length > 0 ? "secondary" : "primary"}
            onClick={() => setPaying(vm.payNow?.kind === "pay" ? vm.payNow.lotIds : [])}
          >
            Pay {formatMoney(vm.payNow.total)}
          </Button>
        </section>
      ) : vm.payNow?.kind === "review" ? (
        <Notice tone="warning" title={vm.payNow.title}>
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
                  selectColumn={cards.some((each) => each.payable)}
                  selection={
                    card.payable
                      ? {
                          selected: selected.has(card.lotId),
                          onSelectedChange: (on) => toggle(card, on),
                        }
                      : null
                  }
                />
              ))}
            </RecordList>
            <ShowingCount shown={cards.length} total={cards.length} />
          </>
        )}
        {organisation ? (
          <p className="text-lax-13 text-lax-muted">
            Owners, admins and finance can pay. Buyer agents see their own wins.
          </p>
        ) : null}
      </div>
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
              onClick={() => setSelected(new Set())}
            >
              <X aria-hidden />
            </Button>
            <p className="text-lax-14 font-medium tabular-nums text-lax-fg">
              {picks.length} selected · {formatMoney(picksTotal)}
            </p>
          </div>
          <Button variant="primary" onClick={() => setPaying(picks)}>
            Pay {picks.length === 1 ? "1 invoice" : `${picks.length} invoices`} ·{" "}
            {formatMoney(picksTotal)}
          </Button>
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
      <PaySeveralDialog
        open={paying !== null}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
        lotIds={paying ?? []}
        cardsById={cardsById}
        organisation={organisation}
      />
    </div>
  );
}
