"use client";

import { BidHistoryDrawer } from "@/components/dashboard/bid-history-drawer";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { type MyBidCardVm, filterMyBidCards, showsMyBidsSearch } from "@/lib/bid/my-bids.vm";
import { Input } from "@auction/ui/components/input";
import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { MyBidCard } from "./my-bid-card";

/**
 * The cards of one My bids view. A search field appears only when the view is long, and each
 * card can open the lot's full bid history in the shared drawer.
 */
export function MyBidsList({ cards }: { cards: readonly MyBidCardVm[] }) {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<{ lotId: string; title: string } | null>(null);
  const searchId = useId();
  const searchable = showsMyBidsSearch(cards.length);
  const visible = useMemo(
    () => (searchable ? filterMyBidCards(cards, query) : cards),
    [cards, query, searchable],
  );

  return (
    <div className="flex flex-col gap-3">
      {searchable ? (
        <div className="relative w-full md:max-w-sm">
          <label htmlFor={searchId} className="sr-only">
            Search these bids
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-on-surface-variant"
          />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, lot or sale"
            className="pl-9"
          />
        </div>
      ) : null}
      {visible.length === 0 ? (
        <DashboardEmptyState
          illustration="search"
          title="No bids match your search"
          description="Try part of the title, the lot number or the sale."
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Lots you have bid on">
          {visible.map((card) => (
            <li key={card.id}>
              <MyBidCard
                card={card}
                onOpenHistory={
                  card.href ? () => setHistory({ lotId: card.lotId, title: card.title }) : null
                }
              />
            </li>
          ))}
        </ul>
      )}
      <output aria-live="polite" className="sr-only">
        {searchable && query.trim() ? `${visible.length} of ${cards.length} bids shown` : ""}
      </output>
      <BidHistoryDrawer
        open={history != null}
        lotId={history?.lotId ?? null}
        lotTitle={history?.title ?? ""}
        onOpenChange={(open) => {
          if (!open) setHistory(null);
        }}
      />
    </div>
  );
}
