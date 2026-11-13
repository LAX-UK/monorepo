"use client";

import { RateSourceCell } from "@/components/admin/seller-proceeds/settlement-sales-table";
import {
  type PayoutPanelModel,
  buildPayoutPanel,
} from "@/lib/admin/seller-proceeds/payout-panel.vm";
import type { PayoutSalesDto } from "@/lib/data/http/admin-seller-proceeds.shared";
import { KeyValueList, Notice, Skeleton, TextLink } from "@auction/staff-ui";
import Link from "next/link";
import { useEffect, useState } from "react";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; model: PayoutPanelModel };

function Heading({ children, count }: { children: string; count?: string }) {
  return (
    <h3 className="flex items-baseline justify-between gap-2 text-staff-sm font-semibold text-staff-fg">
      {children}
      {count ? <span className="font-normal text-staff-muted">{count}</span> : null}
    </h3>
  );
}

/**
 * The money in a payout panel: the payout's stored totals, one line per sale with the rate and
 * agreement it was paid under, and the seller's held sales that are not in it. A payout paid under
 * the old rule keeps its figures and says so.
 */
export function PayoutSalesPanel({
  payoutId,
  loadSales,
  initial,
}: {
  payoutId: string;
  loadSales: (payoutId: string) => Promise<PayoutSalesDto | null>;
  /** For the review route: the sales already loaded. */
  initial?: PayoutSalesDto;
}) {
  const [state, setState] = useState<State>(
    initial ? { kind: "ready", model: buildPayoutPanel(initial) } : { kind: "loading" },
  );

  useEffect(() => {
    if (initial) return;
    let live = true;
    setState({ kind: "loading" });
    loadSales(payoutId).then(
      (dto) => {
        if (live)
          setState(dto ? { kind: "ready", model: buildPayoutPanel(dto) } : { kind: "error" });
      },
      () => {
        if (live) setState({ kind: "error" });
      },
    );
    return () => {
      live = false;
    };
  }, [payoutId, loadSales, initial]);

  if (state.kind === "loading") {
    return (
      <output
        aria-busy="true"
        aria-label="Loading the payout's sales"
        className="flex flex-col gap-2"
      >
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-3/5" />
      </output>
    );
  }
  if (state.kind === "error") {
    return (
      <Notice tone="warning" title="The payout's sales could not load">
        The totals above are as stored. Close and open the payout to try again.
      </Notice>
    );
  }
  const { model } = state;
  return (
    <div className="flex flex-col gap-5">
      {model.oldRuleNote ? (
        <Notice tone="info" title="Paid under the old rule">
          {model.oldRuleNote}
        </Notice>
      ) : null}
      <KeyValueList items={model.figures.map((figure) => ({ ...figure, numeric: true }))} />
      <section className="flex flex-col gap-2" aria-label="In this payout">
        <Heading count={model.inPayoutLabel}>In this payout</Heading>
        <ul className="flex flex-col divide-y divide-staff-line-subtle rounded-staff-lg border border-staff-line">
          {model.lines.map((line) => (
            <li key={line.id} className="flex flex-col gap-1 px-3 py-2 text-staff-sm">
              <div className="flex items-baseline justify-between gap-3">
                <TextLink href={line.lotHref} Link={Link}>
                  {line.lot}
                </TextLink>
                <span className="tabular-nums font-medium">{line.net}</span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-staff-xs text-staff-muted">
                <span>{line.lotTitle}</span>
                <span className="tabular-nums">Hammer {line.hammer}</span>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-x-3 text-staff-xs">
                <span className="text-staff-muted">{line.rate}</span>
                <RateSourceCell source={line.rateSource} />
              </div>
            </li>
          ))}
        </ul>
      </section>
      {model.notInPayout.length > 0 ? (
        <section className="flex flex-col gap-2" aria-label="Not in this payout">
          <Heading>Not in this payout</Heading>
          <ul className="flex flex-col divide-y divide-staff-line-subtle rounded-staff-lg border border-staff-line">
            {model.notInPayout.map((held) => (
              <li
                key={held.id}
                className="flex flex-col gap-0.5 bg-staff-danger-bg px-3 py-2 text-staff-sm text-staff-danger-fg"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <TextLink href={`/admin/lots/${encodeURIComponent(held.lotId)}`} Link={Link}>
                    {held.lot}
                  </TextLink>
                  <span className="tabular-nums">Hammer {held.hammer}</span>
                </div>
                <span className="text-staff-xs">Payout held: {held.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
