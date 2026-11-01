"use client";

import { MediaImage } from "@/components/ui/media-image";
import { ListEmpty, ListLoadError, ListNoResults } from "@/components/workspace/list-states";
import { useListQuery } from "@/components/workspace/use-list-query";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import {
  PAYOUT_STATUS_BADGE,
  SOLD_SORTS,
  SOLD_SORT_LABEL,
  SOLD_VIEWS,
  SOLD_VIEW_LABEL,
  type SoldListQuery,
  type SoldRecord,
  type SoldSort,
  isSoldListNarrowed,
  payoutHref,
  soldInView,
  soldListSearch,
  soldRecord,
  soldYears,
} from "@/lib/seller/sold-and-payouts-list";
import type { PayoutRow, SoldAndPayoutsVm } from "@/lib/seller/sold-and-payouts.vm";
import { lotPath } from "@/lib/seo/url";
import {
  InlineActionMenu,
  type InlineActionMenuItem,
  RecordList,
  RecordRow,
  RecordRowMedia,
} from "@auction/ui";
import {
  ButtonLink,
  Field,
  FilterSheet,
  ListToolbar,
  NativeSelect,
  Notice,
  ShowingCount,
  SortMenu,
  StatusBadge,
  type TabNavItem,
} from "@auction/ui/lax";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const ANY = "any";

function SoldRow({ record }: { record: SoldRecord }) {
  const router = useRouter();
  const lotHref = lotPath({ id: record.lotId, title: record.title });
  const menu: InlineActionMenuItem[] = [
    ...(record.payoutHref
      ? [
          {
            type: "item" as const,
            label: "View payout",
            onSelect: () => router.push(record.payoutHref ?? ""),
          },
        ]
      : []),
    { type: "item", label: "View lot", onSelect: () => router.push(lotHref) },
  ];
  return (
    <RecordRow
      aria-label={`${record.title}, ${record.badge.label}`}
      href={record.payoutHref ?? lotHref}
      linkAs={Link}
      leading={
        <RecordRowMedia>
          <MediaImage src={null} alt="" sizes="48px" />
        </RecordRowMedia>
      }
      title={record.title}
      meta={record.meta}
      figures={[
        { id: "hammer", value: record.hammer, label: "hammer" },
        record.net
          ? { id: "net", value: record.net, label: "you receive" }
          : { id: "net", value: "After payment", label: "you receive", pending: true },
      ]}
      aligned
      status={
        <StatusBadge tone={record.badge.tone} shape={record.badge.shape}>
          {record.badge.label}
        </StatusBadge>
      }
      menu={<InlineActionMenu label={`More for ${record.title}`} items={menu} />}
    />
  );
}

function PayoutListRow({ payout }: { payout: PayoutRow }) {
  const badge = PAYOUT_STATUS_BADGE[payout.status];
  return (
    <RecordRow
      aria-label={`Payout of ${payout.net}, ${badge.label}`}
      href={payoutHref(payout.id)}
      linkAs={Link}
      title={`Payout of ${payout.net}`}
      meta={[payout.period]}
      figures={[
        { id: "gross", value: payout.gross, label: "sales" },
        // The figure cells are a fixed width, so the label stays one short word (commission is a fee).
        { id: "fees", value: payout.fees, label: "fees" },
      ]}
      aligned
      status={
        <StatusBadge tone={badge.tone} shape={badge.shape}>
          {badge.label}
        </StatusBadge>
      }
      menu={
        <InlineActionMenu
          label={`More for the payout of ${payout.net}`}
          items={[
            {
              type: "item",
              label: "Download statement (PDF)",
              onSelect: () => window.location.assign(payout.statementHref),
            },
          ]}
        />
      }
    />
  );
}

/**
 * Sold & payouts: each sold lot with where its money stands (buyer paying, paid, in a payout,
 * paid out), and each payout, which opens to its lines. Search, the year filter and sort follow
 * the address, as on every workspace list.
 */
export function SoldAndPayoutsView({
  vm,
  query: initialQuery,
  organisation,
  setup,
}: {
  /** `null` when the payouts could not be read. */
  vm: SoldAndPayoutsVm | null;
  query: SoldListQuery;
  organisation: string | null;
  /** Where payouts are set up, for a member who may; `null` for one who may not. */
  setup: { href: string } | null;
}) {
  const { query, setQuery, search, setSearch } = useListQuery(initialQuery, soldListSearch);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState(query);
  useEffect(() => {
    if (filterOpen) setDraft(query);
  }, [filterOpen, query]);
  const records = useMemo(() => {
    const now = new Date();
    return vm?.sold?.map((lot) => soldRecord(lot, now)) ?? null;
  }, [vm]);

  if (!vm) return <ListLoadError />;
  const payouts = vm.payouts;
  const soldCount = records?.length ?? 0;
  if (records && soldCount === 0 && payouts.length === 0) {
    return (
      <ListEmpty
        illustration="ledger"
        title="Nothing sold yet"
        description={`Works that sell${organisation ? ` for ${organisation}` : ""}, and each payout, appear here.`}
        actions={
          <ButtonLink href={CLIENT_ROUTES.sellingNew} Link={Link} variant="primary">
            Sell a work
          </ButtonLink>
        }
      />
    );
  }

  const shown = records ? soldInView(records, query) : [];
  const years = records ? soldYears(records) : [];
  const tabs: TabNavItem[] = SOLD_VIEWS.map((id) => ({
    id,
    label: SOLD_VIEW_LABEL[id],
    href: `${CLIENT_ROUTES.payouts}${soldListSearch({ ...query, view: id })}`,
    count: id === "sold" ? (records ? soldInView(records, query).length : 0) : payouts.length,
  }));
  const chips = query.year ? [{ id: "year" as const, label: `Year: ${query.year}` }] : [];
  const clearAll = () => setQuery({ ...query, q: "", year: null });
  const problem = records?.some((record) => record.badge.tone === "warning");

  return (
    <div className="flex flex-col gap-6">
      {!vm.destination.ready ? (
        <Notice
          tone="info"
          title="Payouts aren't set up yet"
          {...(setup
            ? {
                actions: (
                  <ButtonLink href={setup.href} Link={Link}>
                    Set up payouts
                  </ButtonLink>
                ),
              }
            : {})}
        >
          {setup
            ? "Add the bank account we pay sale proceeds into. It takes about 5 minutes."
            : "An owner or admin adds the bank account we pay sale proceeds into."}
        </Notice>
      ) : null}
      {vm.destination.bankFailed ? (
        <Notice
          tone="warning"
          title="A payout couldn't be paid into your bank account"
          {...(setup
            ? {
                actions: (
                  <ButtonLink href={setup.href} Link={Link}>
                    Change bank account
                  </ButtonLink>
                ),
              }
            : {})}
        >
          {setup
            ? "Add another account and we'll send it again."
            : "An owner or admin adds another account, and we'll send it again."}
        </Notice>
      ) : null}
      {problem ? (
        <Notice tone="warning" title="A payout didn't go through">
          We're already on it and will email you once it is sent again. Nothing is needed from you.
        </Notice>
      ) : null}
      <div className="flex flex-col gap-4">
        <ListToolbar
          tabs={{ items: tabs, activeId: query.view, label: "Sold & payouts", Link }}
          {...(query.view === "sold" && records
            ? {
                search: {
                  value: search,
                  onValueChange: setSearch,
                  placeholder: "Search by title or sale",
                },
                ...(years.length > 1
                  ? {
                      filter: {
                        count: chips.length,
                        open: filterOpen,
                        onOpenChange: setFilterOpen,
                      },
                    }
                  : {}),
                sort: (
                  <SortMenu<SoldSort>
                    value={query.sort}
                    onValueChange={(sort) => setQuery({ ...query, sort })}
                    options={SOLD_SORTS.map((value) => ({ value, label: SOLD_SORT_LABEL[value] }))}
                  />
                ),
                chips: {
                  filters: chips,
                  onRemove: () => setQuery({ ...query, year: null }),
                  onClearAll: clearAll,
                },
              }
            : {})}
        />
        {query.view === "payouts" ? (
          payouts.length === 0 ? (
            <ListEmpty
              illustration="ledger"
              title="No payouts yet"
              description="Once a buyer pays, the money joins your next payout, and it appears here."
            />
          ) : (
            <>
              {vm.destination.bank ? (
                <p className="text-lax-13 text-lax-muted">Payouts go to {vm.destination.bank}.</p>
              ) : null}
              <RecordList aria-label="Payouts">
                {payouts.map((payout) => (
                  <PayoutListRow key={payout.id} payout={payout} />
                ))}
              </RecordList>
              <ShowingCount shown={payouts.length} total={payouts.length} />
            </>
          )
        ) : !records ? (
          <ListLoadError />
        ) : shown.length === 0 ? (
          isSoldListNarrowed(query) ? (
            <ListNoResults query={query.q} onClear={clearAll} />
          ) : (
            <ListEmpty
              illustration="ledger"
              title="Nothing sold yet"
              description="Works that sell appear here, with the money on its way."
            />
          )
        ) : (
          <>
            <RecordList aria-label="Sold works">
              {shown.map((record) => (
                <SoldRow key={record.lotId} record={record} />
              ))}
            </RecordList>
            <ShowingCount shown={shown.length} total={shown.length} />
          </>
        )}
      </div>
      {years.length > 1 ? (
        <FilterSheet
          open={filterOpen}
          onOpenChange={setFilterOpen}
          resultCount={records ? soldInView(records, draft).length : 0}
          onApply={() => setQuery(draft)}
          onClear={() => setDraft({ ...draft, year: null })}
        >
          <Field label="Year sold">
            <NativeSelect
              value={draft.year ? String(draft.year) : ANY}
              onValueChange={(value) =>
                setDraft({ ...draft, year: value === ANY ? null : Number(value) })
              }
              options={[
                { value: ANY, label: "Any year" },
                ...years.map((year) => ({ value: String(year), label: String(year) })),
              ]}
            />
          </Field>
        </FilterSheet>
      ) : null}
    </div>
  );
}
