"use client";

import { LotActionArea, type LotActionContext } from "@/components/lot-page/lot-action-area";
import { LotConnectionNotice } from "@/components/lot-page/lot-connection-notice";
import { LotFactGrid } from "@/components/lot-page/lot-fact-grid";
import { useLotPageViewContext } from "@/components/lot-page/lot-page-view-context";
import { LotStateLine } from "@/components/lot-page/lot-state-line";
import type { LotPageView } from "@/lib/lot-page/build-lot-page-view";
import { Skeleton } from "@auction/ui/lax/skeleton";
import { cn } from "@auction/ui/lib/utils";

/** One fact of the grid at its final size: the label, the value and its second line. */
function PendingFact() {
  return (
    <div className="min-w-0">
      <dt>
        <Skeleton className="h-5 w-20" />
      </dt>
      <dd className="m-0 mt-0.5">
        <Skeleton className="h-6 w-28" />
      </dd>
      <dd className="m-0">
        <Skeleton className="h-5 w-24" />
      </dd>
    </div>
  );
}

/**
 * The price block before the first live read lands (CO-7): the page is built from cached reads,
 * so it shows no price, no next bid, no state and no clock, only their places at their final
 * size. The bid area is there, shut until the live read (`LotBidEntry` keeps it disabled).
 */
export function LotPriceBlockPending({ actions }: { actions: LotActionContext }) {
  return (
    <section
      aria-label="Price and bidding"
      aria-busy="true"
      className="mt-6 rounded-lax-card border border-lax-line bg-lax-surface p-5"
    >
      <LotConnectionNotice className="mb-4 -mt-1" />
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-0.5 h-9 w-40" />
      <dl className="m-0 mt-4 grid grid-cols-2 gap-4 border-t border-lax-line-subtle pt-4">
        <PendingFact />
        <PendingFact />
      </dl>
      <div className="mt-4">{actions.bidEntry}</div>
      <output className="sr-only">Loading the latest bid</output>
    </section>
  );
}

/**
 * The price and the one thing to do next, drawn entirely from the lot's view: the label and the
 * figure, the fact line, the estimate and the clock, the viewer's position, and the action. The
 * lifecycle decides every word; nothing here asks what state the lot is in.
 */
export function LotPriceBlockView({
  view,
  actions,
}: {
  view: LotPageView;
  actions: LotActionContext;
}) {
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
        <LotActionArea surface={view.actionSurface} context={actions} view={view} />
      </section>
    );
  }

  return (
    <section
      aria-label="Price and bidding"
      className="mt-6 rounded-lax-card border border-lax-line bg-lax-surface p-5"
    >
      <LotConnectionNotice className="mb-4 -mt-1" />
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

      <LotActionArea surface={view.actionSurface} context={actions} view={view} />
    </section>
  );
}

/** The price block of the lot in the page's live view. */
export function LotPriceBlock({ actions }: { actions: LotActionContext }) {
  const { live, view } = useLotPageViewContext();
  if (!live) return <LotPriceBlockPending actions={actions} />;
  return <LotPriceBlockView view={view} actions={actions} />;
}
