"use client";

import { fetchSessionUserAfterAuth } from "@/lib/auth/fetch-session-user.client";
import { fetchLotBidHistoryRows } from "@/lib/bid/fetch-lot-bid-history.client";
import { PLATFORM_DEFAULT_CURRENCY, formatMoney } from "@/lib/format-currency";
import { Skeleton } from "@auction/ui";
import { DrawerDetail } from "@auction/ui/components/drawer-detail";
import { useEffect, useState } from "react";

type BidHistoryRow = {
  id: string;
  amount: string;
  createdAt: string;
  /** True when the bid belongs to the signed-in user. */
  mine: boolean;
  /** Anonymised reference for other bidders. */
  bidderRef: string;
};

type BidHistoryDrawerProps = {
  open: boolean;
  lotId: string | null;
  lotTitle: string;
  onOpenChange: (open: boolean) => void;
};

/** Bid history side panel — shows the full bid escalation timeline for a lot
 * with the signed-in user's bids highlighted.
 */
export function BidHistoryDrawer({ open, lotId, lotTitle, onOpenChange }: BidHistoryDrawerProps) {
  const [rows, setRows] = useState<BidHistoryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownershipWarning, setOwnershipWarning] = useState(false);

  useEffect(() => {
    if (!open || !lotId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOwnershipWarning(false);
    setRows(null);
    void (async () => {
      try {
        const body = await fetchLotBidHistoryRows(lotId, 200);
        if (!body) {
          if (!cancelled) setError("Could not load bid history.");
          return;
        }
        const me = await fetchSessionUserAfterAuth();
        if (cancelled) return;
        if (!me) {
          setOwnershipWarning(true);
        }
        setRows(
          body.map((r) => ({
            id: r.id,
            amount: r.amount,
            createdAt: r.createdAt,
            mine: me != null && r.placedByUserId === me.id,
            bidderRef: r.bidderRef ?? "Bidder",
          })),
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load bid history.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, lotId]);

  return (
    <DrawerDetail
      open={open}
      onOpenChange={onOpenChange}
      title={lotTitle}
      description="Bid history for this lot — your bids are highlighted."
    >
      <div key={lotId ?? "none"} className="space-y-3 font-body text-sm">
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <p role="alert" className="text-error">
            {error}
          </p>
        ) : rows == null || rows.length === 0 ? (
          <p className="text-on-surface-variant">No bids recorded for this lot yet.</p>
        ) : (
          <>
            {ownershipWarning ? (
              <p role="alert" className="text-xs text-on-surface-variant">
                Could not verify your account — your own bids may not be highlighted.
              </p>
            ) : null}
            <ol className="space-y-2">
              {rows.map((row, index) => (
                <li
                  key={row.id}
                  className={
                    row.mine
                      ? "flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 p-3"
                      : "flex items-center justify-between gap-3 rounded-lg border border-border-hairline bg-surface-container-low/50 p-3"
                  }
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-container-high font-label text-[10px] uppercase tracking-wider text-on-surface-variant"
                      aria-hidden
                    >
                      {rows.length - index}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-headline text-sm font-semibold text-on-surface">
                        {row.mine ? "You" : row.bidderRef}
                      </span>
                      <time
                        dateTime={row.createdAt}
                        className="block font-label text-[10px] uppercase tracking-wider text-on-surface-variant"
                      >
                        {new Date(row.createdAt).toLocaleString()}
                      </time>
                    </span>
                  </span>
                  <span className="font-headline text-base font-semibold tabular-nums">
                    {formatMoney(row.amount, PLATFORM_DEFAULT_CURRENCY)}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </DrawerDetail>
  );
}
