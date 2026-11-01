"use client";

import { useLotPageViewContext } from "@/components/lot-page/lot-page-view-context";
import { buildLotHistoryView } from "@/lib/lot-page/lot-history-rows";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/lax";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState } from "react";

/**
 * The anonymised bid history as a disclosure: closed it reads "6 bids"; open it lists the last
 * three, newest first, with "You" on the viewer's own, and "See all" for the rest. No bidder or
 * paddle is ever named.
 */
export function LotBidHistory() {
  const { view, history, nowMs } = useLotPageViewContext();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const listId = useId();

  if (!view.sections.history) return null;
  const content = buildLotHistoryView(history, nowMs, showAll);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <section
      aria-label="Bid history"
      className={cn("mt-6 border-t border-lax-line", !open && "border-b")}
    >
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
          className="lax-focus -mx-1 flex h-13 w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-1 text-left text-lax-14 transition-colors duration-150 hover:bg-lax-hover active:bg-lax-pressed"
        >
          <Chevron aria-hidden className="size-4 shrink-0 text-lax-muted" />
          <span className="font-semibold text-lax-fg">Bid history</span>
          <span className="flex-1 text-lax-muted">{content.summary}</span>
        </button>
      </h2>
      <div id={listId} hidden={!open}>
        {content.rows.length > 0 ? (
          <ol className="m-0 mb-2 list-none p-0">
            {content.rows.map((row) => (
              <li
                key={row.key}
                className="grid min-h-10 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0 border-t border-lax-line-subtle px-1 py-2 text-lax-13 leading-5 sm:grid-cols-[6rem_minmax(0,1fr)_auto]"
              >
                <b className="text-lax-14 font-semibold tabular-nums">{row.amount}</b>
                {row.isViewer ? (
                  <span className="w-fit rounded-lax-badge bg-lax-neutral-bg px-2 text-lax-12 leading-5 font-medium text-lax-neutral-fg">
                    You
                  </span>
                ) : (
                  <span className="text-lax-fg">Bidder</span>
                )}
                <span className="col-start-2 text-lax-muted sm:col-start-auto">{row.detail}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="m-0 border-t border-lax-line-subtle px-1 py-3 text-lax-13 leading-5 text-lax-muted">
            No bids yet.
          </p>
        )}
        {!showAll && content.hiddenCount > 0 ? (
          <div className="pb-3">
            <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
              See all {content.hiddenCount + content.rows.length} bids
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
