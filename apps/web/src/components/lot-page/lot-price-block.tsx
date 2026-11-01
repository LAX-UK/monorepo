"use client";

import { LotActionArea, type LotActionContext } from "@/components/lot-page/lot-action-area";
import { LotFactGrid } from "@/components/lot-page/lot-fact-grid";
import { useLotPageViewContext } from "@/components/lot-page/lot-page-view-context";
import { LotStateLine } from "@/components/lot-page/lot-state-line";
import { cn } from "@auction/ui";

/**
 * The price and the one thing to do next, drawn entirely from the lot's view: the label and the
 * figure, the fact line, the estimate and the clock, the viewer's position, and the action. The
 * lifecycle decides every word; nothing here asks what state the lot is in.
 */
export function LotPriceBlock({ actions }: { actions: LotActionContext }) {
  const { view } = useLotPageViewContext();
  const { price } = view;

  if (view.withdrawn) {
    return (
      <section
        aria-label="Price and bidding"
        className="mt-6 rounded-lax-card border border-lax-line bg-lax-surface p-5"
      >
        <span className="block text-lax-13 leading-5 text-lax-muted">{view.badge.label}</span>
        <p className="m-0 mt-1 text-lax-18 leading-6 font-medium text-lax-fg">
          {price.subLine ?? "This lot is no longer in the sale"}
        </p>
        <p className="m-0 mt-2 text-lax-13 leading-5 text-lax-muted">
          The rest of the sale is unaffected.
        </p>
        <LotActionArea surface={view.actionSurface} context={actions} />
      </section>
    );
  }

  return (
    <section
      aria-label="Price and bidding"
      className="mt-6 rounded-lax-card border border-lax-line bg-lax-surface p-5"
    >
      <span className="block text-lax-13 leading-5 text-lax-muted">{price.label}</span>
      {price.amountText ? (
        <span
          className={cn(
            "mt-0.5 block text-lax-28 leading-9 font-semibold tracking-tight tabular-nums text-lax-fg",
          )}
        >
          {price.amountText}
        </span>
      ) : null}
      {price.subLine ? (
        <span className="mt-0.5 block text-lax-13 leading-5 text-lax-muted">{price.subLine}</span>
      ) : null}

      <LotFactGrid rows={view.rows} />

      {price.stateLine || price.agentLine ? (
        <div className="mt-4 grid gap-2">
          {price.stateLine ? <LotStateLine line={price.stateLine} /> : null}
          {price.agentLine ? <LotStateLine line={price.agentLine} /> : null}
        </div>
      ) : null}

      <LotActionArea surface={view.actionSurface} context={actions} />
    </section>
  );
}
