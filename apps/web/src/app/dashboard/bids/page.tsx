import { getServerMyBids } from "@/lib/data/http/dashboard.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { formatMoney } from "@/lib/format-currency";
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
  try {
    rows = await getServerMyBids();
  } catch {
    rows = [];
  }

  const latestByAuction = new Map<string, (typeof rows)[0]>();
  for (const row of rows) {
    const prev = latestByAuction.get(row.bid.auctionId);
    if (!prev || row.bid.createdAt > prev.bid.createdAt) {
      latestByAuction.set(row.bid.auctionId, row);
    }
  }
  const unique = [...latestByAuction.values()];

  function statusFor(row: (typeof rows)[0]): { label: string; className: string } {
    const a = row.auction;
    if (!a) return { label: "Unknown", className: "text-secondary" };
    if (a.status === "ended") {
      const won = user?.id && a.winnerId === user.id;
      return won
        ? { label: "Won", className: "text-primary" }
        : { label: "Closed", className: "text-secondary" };
    }
    if (a.status !== "active") {
      return { label: a.status, className: "text-secondary" };
    }
    const myAmount = Number.parseFloat(row.bid.amount);
    const high = Number.parseFloat(a.currentPrice);
    const winning = row.bid.isWinning && Math.abs(myAmount - high) < 0.02;
    if (winning) return { label: "Winning", className: "text-primary" };
    return { label: "Outbid", className: "text-error" };
  }

  return (
    <div className="max-w-5xl">
      <h1 className="mb-2 font-headline text-4xl tracking-tight">Active bids</h1>
      <p className="mb-10 font-body text-sm text-on-surface-variant">
        Your latest bid per lot. Open a lot to raise your offer.
      </p>

      {unique.length === 0 ? (
        <div className="border border-outline-variant/15 bg-surface-container-low p-10 text-center">
          <p className="mb-4 font-body text-on-surface-variant">You have no bids yet.</p>
          <Link
            href="/"
            className="font-label text-[10px] font-bold uppercase tracking-widest text-primary underline"
          >
            Browse live auctions
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto border border-outline-variant/15">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/20 bg-surface-container-low">
                <th className="px-4 py-4 font-label text-[10px] uppercase tracking-widest text-secondary">
                  Artwork
                </th>
                <th className="px-4 py-4 font-label text-[10px] uppercase tracking-widest text-secondary">
                  Your bid
                </th>
                <th className="px-4 py-4 font-label text-[10px] uppercase tracking-widest text-secondary">
                  Current high
                </th>
                <th className="px-4 py-4 font-label text-[10px] uppercase tracking-widest text-secondary">
                  Time left
                </th>
                <th className="px-4 py-4 font-label text-[10px] uppercase tracking-widest text-secondary">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {unique.map((row) => {
                const a = row.auction;
                const st = statusFor(row);
                const timeLeft =
                  a && a.status === "active"
                    ? formatRemaining(a.endTime.getTime(), now)
                    : a?.status === "ended"
                      ? "—"
                      : "—";
                return (
                  <tr
                    key={row.bid.id}
                    className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-low/50"
                  >
                    <td className="px-4 py-4">
                      {a ? (
                        <Link
                          href={`/artwork/${a.id}`}
                          className="font-headline text-lg font-light text-on-surface underline-offset-4 hover:underline"
                        >
                          {a.title}
                        </Link>
                      ) : (
                        <span className="text-secondary">Removed lot</span>
                      )}
                    </td>
                    <td className="px-4 py-4 font-headline text-on-surface">
                      {formatMoney(row.bid.amount)}
                    </td>
                    <td className="px-4 py-4 font-headline text-on-surface">
                      {a ? formatMoney(a.currentPrice) : "—"}
                    </td>
                    <td className="px-4 py-4 font-body text-sm tabular-nums text-on-surface-variant">
                      {timeLeft}
                    </td>
                    <td
                      className={`px-4 py-4 font-label text-[10px] font-bold uppercase tracking-widest ${st.className}`}
                    >
                      {st.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
