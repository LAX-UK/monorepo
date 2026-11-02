"use client";

import { ListEmpty, ListLoadError, ListNoResults } from "@/components/workspace/list-states";
import { useListQuery } from "@/components/workspace/use-list-query";
import { SELL_A_WORK_LABEL } from "@/lib/marketing/sell-flow-copy";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { ConsignmentRecord } from "@/lib/seller/consignment-records";
import { consignmentStep } from "@/lib/seller/consignment-step";
import {
  CONSIGNMENT_SORTS,
  CONSIGNMENT_SORT_LABEL,
  CONSIGNMENT_VIEWS,
  CONSIGNMENT_VIEW_LABEL,
  type ConsignmentSort,
  type ConsignmentView,
  type ConsignmentsListQuery,
  appliedConsignmentFilters,
  consignmentSenders,
  consignmentViewCounts,
  consignmentsInView,
  consignmentsListSearch,
  isConsignmentListNarrowed,
} from "@/lib/seller/consignments-list";
import { RecordList } from "@auction/ui";
import {
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
import Link from "next/link";
import { useEffect, useState } from "react";
import { ConsignmentRow } from "./consignment-row";
import { HowSellingWorks } from "./how-selling-works";

const ANY = "any";

const EMPTY_VIEW: Record<ConsignmentView, { title: string; description: string }> = {
  all: { title: "No consignments", description: "Works you send us to sell appear here." },
  "needs-you": {
    title: "Nothing needs you",
    description: "Agreements to accept, changes to make and unsold choices appear here.",
  },
  drafts: {
    title: "No drafts",
    description: "A work you save and finish later waits here until you send it.",
  },
  "in-review": {
    title: "Nothing in review",
    description: "Works our specialists are reviewing appear here.",
  },
  accepted: {
    title: "Nothing accepted",
    description: "Works our specialists accepted appear here until they are in a sale.",
  },
  "in-sale": {
    title: "Nothing in a sale",
    description: "Works catalogued for a sale appear here until it closes.",
  },
  sold: { title: "Nothing sold yet", description: "Works that sell appear here." },
  unsold: {
    title: "Nothing to decide",
    description: "A work that does not sell appears here, with the choices for what happens next.",
  },
};

/**
 * Consignments for the account in use: what waits on the member first, then every stage, with
 * search, the sender filter, sort and export. A row offers one step; the rest is on the record.
 */
export function ConsignmentsView({
  records,
  query: initialQuery,
  organisation,
  canSell,
  pausedReason,
  truncated,
}: {
  /** `null` when the consignments could not be read. */
  records: ConsignmentRecord[] | null;
  query: ConsignmentsListQuery;
  /** The organisation's name, or `null` for a person's own account. */
  organisation: string | null;
  canSell: boolean;
  /** Why selling is held for the account, when its state holds it. */
  pausedReason: string | null;
  truncated: boolean;
}) {
  const { query, setQuery, search, setSearch } = useListQuery(initialQuery, consignmentsListSearch);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState(query);
  useEffect(() => {
    if (filterOpen) setDraft(query);
  }, [filterOpen, query]);

  if (!records) return <ListLoadError />;
  const pausedNotice =
    pausedReason && organisation ? (
      <Notice tone="warning" title={`Selling is paused for ${organisation}.`}>
        You can read every consignment. Steps open again once we hear from {organisation}.
      </Notice>
    ) : null;
  if (records.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {pausedNotice}
        <ListEmpty
          illustration="easel"
          title="No consignments yet"
          description="When you send us a work to sell, it appears here with each step from our specialists' review to the sale and your payout."
          {...(canSell
            ? {
                actions: (
                  <ButtonLink href={CLIENT_ROUTES.sellingNew} Link={Link} variant="primary">
                    {SELL_A_WORK_LABEL}
                  </ButtonLink>
                ),
              }
            : {})}
        />
        <HowSellingWorks />
      </div>
    );
  }

  const counts = consignmentViewCounts(records, query);
  const shown = consignmentsInView(records, query);
  const senders = organisation ? consignmentSenders(records) : [];
  const tabs: TabNavItem[] = CONSIGNMENT_VIEWS.map((id) => ({
    id,
    label: CONSIGNMENT_VIEW_LABEL[id],
    href: `${CLIENT_ROUTES.consignments}${consignmentsListSearch({ ...query, view: id, stage: null })}`,
    count: counts[id],
    ...(id === "needs-you" && counts[id] > 0 ? { countTone: "attention" as const } : {}),
  }));
  const chips = appliedConsignmentFilters(query);
  const filterable = senders.length > 1;
  const clearAll = () => setQuery({ ...query, q: "", sentBy: null, stage: null });
  const empty = EMPTY_VIEW[query.view];
  const access = { canSell, pausedReason };

  return (
    <div className="flex flex-col gap-6">
      {pausedNotice}
      <div className="flex flex-col gap-4">
        <ListToolbar
          tabs={{ items: tabs, activeId: query.view, label: "Consignments", Link }}
          search={{
            value: search,
            onValueChange: setSearch,
            placeholder: "Search by title, reference or sale",
          }}
          {...(filterable
            ? { filter: { count: chips.length, open: filterOpen, onOpenChange: setFilterOpen } }
            : {})}
          sort={
            <SortMenu<ConsignmentSort>
              value={query.sort}
              onValueChange={(sort) => setQuery({ ...query, sort })}
              options={CONSIGNMENT_SORTS.map((value) => ({
                value,
                label: CONSIGNMENT_SORT_LABEL[value],
              }))}
            />
          }
          chips={{
            filters: chips,
            onRemove: (id) => setQuery({ ...query, [id]: null }),
            onClearAll: clearAll,
          }}
        />
        {shown.length === 0 ? (
          isConsignmentListNarrowed(query) ? (
            <ListNoResults query={query.q} onClear={clearAll} />
          ) : (
            <ListEmpty illustration="easel" title={empty.title} description={empty.description} />
          )
        ) : (
          <>
            <RecordList aria-label={`${CONSIGNMENT_VIEW_LABEL[query.view]} consignments`}>
              {shown.map((record) => (
                <ConsignmentRow
                  key={record.key}
                  record={record}
                  step={consignmentStep(record, access)}
                />
              ))}
            </RecordList>
            <ShowingCount shown={shown.length} total={shown.length} />
          </>
        )}
        {truncated ? (
          <p className="text-lax-13 text-lax-muted">
            Showing your most recent works. For older ones, contact your specialist.
          </p>
        ) : null}
      </div>
      {filterable ? (
        <FilterSheet
          open={filterOpen}
          onOpenChange={setFilterOpen}
          resultCount={consignmentsInView(records, draft).length}
          onApply={() => setQuery(draft)}
          onClear={() => setDraft({ ...draft, sentBy: null, stage: null })}
        >
          <Field label="Sent by">
            <NativeSelect
              value={draft.sentBy ?? ANY}
              onValueChange={(value) =>
                setDraft({ ...draft, sentBy: value === ANY ? null : value })
              }
              options={[
                { value: ANY, label: "Anyone" },
                ...senders.map((name) => ({ value: name, label: name })),
              ]}
            />
          </Field>
        </FilterSheet>
      ) : null}
    </div>
  );
}
