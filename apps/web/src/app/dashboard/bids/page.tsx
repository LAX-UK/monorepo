import { getServerMyBids } from "@/lib/data/http/dashboard.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { formatMoney } from "@/lib/format-currency";
import Image from "next/image";
import Link from "next/link";

function formatRemaining(endMs: number, now: number): string {
  const ms = endMs - now;
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export default async function DashboardBidsPage() {
  const user = await getServerSessionUser();
  const now = Date.now();
  let rows: Awaited<ReturnType<typeof getServerMyBids>> = [];
  let fetchError: string | null = null;
  try {
    rows = await getServerMyBids();
  } catch (e) {
    rows = [];
    fetchError = e instanceof Error ? e.message : "Could not load bids.";
  }

  const latestByAuction = new Map<string, (typeof rows)[0]>();
  for (const row of rows) {
    const prev = latestByAuction.get(row.bid.auctionId);
    if (!prev || row.bid.createdAt > prev.bid.createdAt) {
      latestByAuction.set(row.bid.auctionId, row);
    }
  }
  const unique = [...latestByAuction.values()].sort((a, b) => {
    const ae = a.auction?.endTime.getTime() ?? 0;
    const be = b.auction?.endTime.getTime() ?? 0;
    return ae - be;
  });

  function statusFor(row: (typeof rows)[0]): { label: string; className: string; outbid: boolean } {
    const a = row.auction;
    if (!a) return { label: "Unknown", className: "text-secondary", outbid: false };
    if (a.status === "ended") {
      const won = user?.id && a.winnerId === user.id;
      return won
        ? { label: "Won", className: "text-primary", outbid: false }
        : { label: "Closed", className: "text-secondary", outbid: false };
    }
    if (a.status !== "active") {
      return { label: a.status, className: "text-secondary", outbid: false };
    }
    const myAmount = Number.parseFloat(row.bid.amount);
    const high = Number.parseFloat(a.currentPrice);
    const winning = row.bid.isWinning && Math.abs(myAmount - high) < 0.02;
    if (winning) return { label: "Winning", className: "text-primary", outbid: false };
    return { label: "Outbid", className: "text-error", outbid: true };
  }

  return (
    <div className="max-w-6xl">
      <h1 className="mb-2 font-headline text-4xl tracking-tight">Active bids</h1>
      <p className="mb-10 font-body text-sm text-on-surface-variant">
        Your latest bid per lot, sorted by closing time. Increase your offer in one click.
      </p>

      {fetchError ? (
        <div className="mb-8 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {fetchError}
        </div>
      ) : null}

      {unique.length === 0 ? (
        <div className="rounded-xl bg-surface-container-low p-10 text-center shadow-sm ring-1 ring-outline-variant/10">
          <p className="mb-4 font-body text-on-surface-variant">
            {fetchError ? "Unable to load bids right now." : "You have no bids yet."}
          </p>
          {!fetchError ? (
            <Link
              href="/"
              className="font-label text-xs font-bold uppercase tracking-widest text-primary underline"
            >
              Browse live auctions
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          {unique.map((row) => {
            const a = row.auction;
            const st = statusFor(row);
            const timeLeft =
              a && a.status === "active"
                ? formatRemaining(a.endTime.getTime(), now)
                : a?.status === "ended"
                  ? "—"
                  : "—";
            const img = a?.images[0];
            return (
              <div
                key={row.bid.id}
                className="flex flex-col gap-4 rounded-xl bg-surface-container-low p-4 shadow-sm ring-1 ring-outline-variant/10 md:flex-row md:items-center"
              >
                <div className="relative h-28 w-full flex-shrink-0 overflow-hidden rounded-lg bg-surface-container-high md:h-24 md:w-36">
                  {img ? (
                    <Image
                      src={img}
                      alt=""
                      fill
                      className={`object-cover ${st.outbid ? "grayscale" : ""}`}
                      sizes="144px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  {a ? (
                    <Link
                      href={`/artwork/${a.id}`}
                      className="font-headline text-xl font-light text-on-surface underline-offset-4 hover:underline"
                    >
                      {a.title}
                    </Link>
                  ) : (
                    <span className="text-secondary">Removed lot</span>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-body text-sm text-on-surface-variant">
                    <span>
                      Your bid:{" "}
                      <span className={st.outbid ? "line-through" : ""}>
                        {formatMoney(row.bid.amount)}
                      </span>
                    </span>
                    {a ? (
                      <span className="text-on-surface">
                        Current high: {formatMoney(a.currentPrice)}
                      </span>
                    ) : null}
                    <span className="tabular-nums">{timeLeft}</span>
                  </div>
                </div>
                <div className="flex flex-col items-stretch gap-2 md:w-44">
                  <span
                    className={`font-label text-xs font-bold uppercase tracking-widest ${st.className}`}
                  >
                    {st.label}
                  </span>
                  {a?.status === "active" ? (
                    <Link
                      href={`/artwork/${a.id}`}
                      className="inline-flex items-center justify-center bg-gradient-to-br from-primary to-primary-container py-3 text-center font-label text-xs font-bold uppercase tracking-widest text-on-primary shadow-sm transition-opacity hover:opacity-95"
                    >
                      Re-bid now
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
