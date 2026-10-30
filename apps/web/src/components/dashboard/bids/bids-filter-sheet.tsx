"use client";

import { type BidsListQuery, bidsInView } from "@/lib/bid/bids-list";
import { type MyBidStatus, type MyBidTab, myBidTab } from "@/lib/bid/my-bid-status";
import { MY_BID_STATUS_LABEL, type MyBidsVm } from "@/lib/bid/my-bids.vm";
import { Field, FilterSheet, NativeSelect } from "@auction/ui/lax";
import { useEffect, useMemo, useState } from "react";

const ANY = "any";

/**
 * The Bids filters in the shared sheet: the sale, who placed the bid (on a shared list) and the
 * status within the view. Choices apply with "Show n results", which counts as they change.
 */
export function BidsFilterSheet({
  open,
  onOpenChange,
  query,
  onApply,
  vm,
  shared,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: BidsListQuery;
  onApply: (query: BidsListQuery) => void;
  vm: MyBidsVm;
  shared: boolean;
}) {
  const [draft, setDraft] = useState(query);
  useEffect(() => {
    if (open) setDraft(query);
  }, [open, query]);

  const view: MyBidTab = query.view === "sales" ? "active" : query.view;
  const statuses = useMemo(
    () =>
      (Object.keys(MY_BID_STATUS_LABEL) as MyBidStatus[]).filter(
        (status) =>
          myBidTab(status) === view && vm.cardsByTab[view].some((card) => card.status === status),
      ),
    [vm, view],
  );
  const resultCount = bidsInView(vm.cardsByTab[view], draft).length;

  return (
    <FilterSheet
      open={open}
      onOpenChange={onOpenChange}
      resultCount={resultCount}
      onApply={() => onApply(draft)}
      onClear={() => setDraft({ ...draft, sale: null, by: null, status: null })}
    >
      <Field label="Sale">
        <NativeSelect
          value={draft.sale ?? ANY}
          onValueChange={(value) => setDraft({ ...draft, sale: value === ANY ? null : value })}
          options={[
            { value: ANY, label: "Any sale" },
            ...vm.sales.map((sale) => ({ value: sale.id, label: sale.title })),
          ]}
        />
      </Field>
      {shared && vm.placers.length > 0 ? (
        <Field label="Placed by">
          <NativeSelect
            value={draft.by ?? ANY}
            onValueChange={(value) => setDraft({ ...draft, by: value === ANY ? null : value })}
            options={[
              { value: ANY, label: "Anyone" },
              ...vm.placers.map((name) => ({ value: name, label: name })),
            ]}
          />
        </Field>
      ) : null}
      {statuses.length > 1 ? (
        <Field label="Status">
          <NativeSelect
            value={draft.status ?? ANY}
            onValueChange={(value) =>
              setDraft({ ...draft, status: value === ANY ? null : (value as MyBidStatus) })
            }
            options={[
              { value: ANY, label: "Any status" },
              ...statuses.map((status) => ({ value: status, label: MY_BID_STATUS_LABEL[status] })),
            ]}
          />
        </Field>
      ) : null}
    </FilterSheet>
  );
}
