"use client";

import { formatMoney } from "@/lib/format-currency";
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

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

/** Bid history side panel — shows the full bid escalation timeline for a lot
 * with the signed-in user's bids highlighted.
 */
export function BidHistoryDrawer({ open, lotId, lotTitle, onOpenChange }: BidHistoryDrawerProps) {
  const [rows, setRows] = useState<BidHistoryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !lotId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRows(null);
    void (async () => {
      try {
        const res = await fetch(`${apiBase()}/lots/${encodeURIComponent(lotId)}/bids?limit=200`, {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setError(`Could not load bid history (${res.status}).`);
          return;
        }
        const body = (await res.json()) as {
          data: Array<{
            id: string;
            amount: string;
            createdAt: string;
            placedByUserId: string | null;
            bidderRef?: string;
          }>;
        };
        const meRes = await fetch(`${apiBase()}/users/me`, { credentials: "include" });
        const me = meRes.ok ? ((await meRes.json()) as { data: { id: string } }).data.id : null;
        if (cancelled) return;
        setRows(
          body.data.map((r) => ({
            id: r.id,
            amount: r.amount,
            createdAt: r.createdAt,
            mine: me != null && r.placedByUserId === me,
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
      description="Bid history for this lot \u2014 your bids are highlighted."
    >
      <div className="space-y-3 font-body text-sm">
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
                  {formatMoney(row.amount)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </DrawerDetail>
  );
}
