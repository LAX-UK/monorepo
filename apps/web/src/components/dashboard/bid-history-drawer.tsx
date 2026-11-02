"use client";

import { fetchSessionUserAfterAuth } from "@/lib/auth/fetch-session-user.client";
import { fetchLotBidHistoryRows } from "@/lib/bid/fetch-lot-bid-history.client";
import { PLATFORM_DEFAULT_CURRENCY, formatMoney } from "@/lib/format-currency";
import { formatDateTimeShort } from "@/lib/ui/format";
import { Skeleton } from "@auction/ui";
import { DrawerDetail } from "@auction/ui/components/drawer-detail";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Button } from "@auction/ui/lax";
import { RotateCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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

/**
 * A lot's bid history in a side panel: every bid, newest first, with the signed-in person's own
 * bids highlighted. A failed read says so calmly and offers to try again.
 */
export function BidHistoryDrawer({ open, lotId, lotTitle, onOpenChange }: BidHistoryDrawerProps) {
  const [rows, setRows] = useState<BidHistoryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ownershipWarning, setOwnershipWarning] = useState(false);

  /** Reads the lot's bids; `isStale` stops a slow answer from overwriting a newer one. */
  const load = useCallback(
    async (isStale: () => boolean) => {
      if (!lotId) return;
      setLoading(true);
      setFailed(false);
      setOwnershipWarning(false);
      setRows(null);
      try {
        const body = await fetchLotBidHistoryRows(lotId, 200);
        if (isStale()) return;
        if (!body) {
          setFailed(true);
          return;
        }
        const me = await fetchSessionUserAfterAuth();
        if (isStale()) return;
        setOwnershipWarning(!me);
        setRows(
          body.map((r) => ({
            id: r.id,
            amount: r.amount,
            createdAt: r.createdAt,
            mine: me != null && r.placedByUserId === me.id,
            bidderRef: r.bidderRef ?? "Bidder",
          })),
        );
      } catch {
        if (!isStale()) setFailed(true);
      } finally {
        if (!isStale()) setLoading(false);
      }
    },
    [lotId],
  );

  useEffect(() => {
    if (!open) return;
    let stale = false;
    void load(() => stale);
    return () => {
      stale = true;
    };
  }, [open, load]);

  return (
    <DrawerDetail
      open={open}
      onOpenChange={onOpenChange}
      title={lotTitle}
      description="Every bid on this lot, newest first. Yours are highlighted."
    >
      <div key={lotId ?? "none"} className="space-y-3 font-body text-sm">
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : failed ? (
          <EmptyState
            variant="plain"
            size="compact"
            headingLevel="h3"
            illustration="askew"
            role="alert"
            title="We couldn't load the bid history"
            description="This is on our side. Your bids are safe and still active in the sale."
            action={
              <Button type="button" variant="secondary" onClick={() => void load(() => false)}>
                <RotateCw aria-hidden />
                Try again
              </Button>
            }
          />
        ) : rows == null || rows.length === 0 ? (
          <EmptyState
            variant="plain"
            size="compact"
            headingLevel="h3"
            illustration="gavel"
            title="No bids recorded for this lot yet"
          />
        ) : (
          <>
            {ownershipWarning ? (
              <p role="alert" className="text-xs text-on-surface-variant">
                We couldn't confirm your account, so your own bids may not be highlighted.
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
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-container-high font-body text-xs tabular-nums text-on-surface-variant"
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
                        className="block font-body text-xs tabular-nums text-on-surface-variant"
                      >
                        {formatDateTimeShort(row.createdAt)}
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
