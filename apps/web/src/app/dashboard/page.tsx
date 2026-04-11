import { getServerAuctionReader } from "@/lib/data/http/auctions.server";
import { getServerMyPortfolio } from "@/lib/data/http/dashboard.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { formatMoney } from "@/lib/format-currency";
import Image from "next/image";
import Link from "next/link";

export default async function DashboardHomePage() {
  const user = await getServerSessionUser();
  const reader = await getServerAuctionReader();
  const [active, portfolio] = await Promise.all([
    reader.list({ status: "active", limit: 6 }),
    getServerMyPortfolio().catch(() => [] as Awaited<ReturnType<typeof getServerMyPortfolio>>),
  ]);

  const firstName = user?.name?.split(/\s+/)[0] ?? "curator";
  const totalSpent = portfolio.reduce((sum, a) => sum + Number.parseFloat(a.currentPrice), 0);

  return (
    <div className="max-w-[1920px]">
      <section className="mb-12">
        <h1 className="mb-4 font-headline text-5xl tracking-tight text-on-surface md:text-6xl">
          Welcome back, {firstName}.
        </h1>
        <p className="font-label text-sm uppercase tracking-[0.2em] text-secondary">
          {active.length} live lots • {portfolio.length} acquired work{portfolio.length === 1 ? "" : "s"}
        </p>
      </section>

      <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <p className="mb-2 font-label text-[10px] uppercase tracking-widest text-secondary">
            Active lots
          </p>
          <p className="font-headline text-3xl text-on-surface">{active.length}</p>
        </div>
        <div className="border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <p className="mb-2 font-label text-[10px] uppercase tracking-widest text-secondary">
            Lots won
          </p>
          <p className="font-headline text-3xl text-on-surface">{portfolio.length}</p>
        </div>
        <div className="border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <p className="mb-2 font-label text-[10px] uppercase tracking-widest text-secondary">
            Collection (hammer)
          </p>
          <p className="font-headline text-3xl text-primary">{formatMoney(totalSpent.toFixed(2))}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="font-headline text-2xl">Live inventory</h2>
            <span className="border-b border-primary-container pb-1 font-label text-[0.6875rem] uppercase tracking-widest text-primary">
              Pulled from API
            </span>
          </div>
          <div className="space-y-12">
            {active.length === 0 ? (
              <p className="text-secondary">No active auctions right now.</p>
            ) : (
              active.map((a) => {
                const img = a.images[0];
                return (
                  <Link
                    key={a.id}
                    href={`/artwork/${a.id}`}
                    className="flex flex-col gap-6 border-b border-outline-variant/10 pb-12 transition-opacity last:border-0 hover:opacity-90 md:flex-row md:items-center"
                  >
                    <div className="relative h-32 w-full flex-shrink-0 overflow-hidden bg-surface-container-low md:w-48">
                      {img ? (
                        <Image src={img} alt="" fill className="object-cover" sizes="192px" />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col justify-center space-y-2">
                      <span className="font-label text-[0.65rem] uppercase tracking-[0.4em] text-secondary">
                        Lot
                      </span>
                      <h3 className="font-headline text-3xl font-light text-on-surface">{a.title}</h3>
                      <p className="font-label text-[10px] uppercase tracking-widest text-primary">
                        Current {formatMoney(a.currentPrice)}
                      </p>
                    </div>
                    <div className="text-right font-headline text-2xl text-on-surface">
                      {formatMoney(a.currentPrice)}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
        <div className="lg:col-span-4">
          <div className="border border-outline-variant/15 bg-surface-container-low p-8">
            <h3 className="mb-4 font-headline text-xl">Account</h3>
            <p className="font-body text-sm text-secondary">
              <span className="font-medium text-on-surface">Role:</span> {user?.role ?? "—"}
            </p>
            <p className="mt-4 font-body text-xs text-on-surface-variant">
              Manage bids under Active Bids; won lots appear in Portfolio.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
