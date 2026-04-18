import { getServerMyPortfolio } from "@/lib/data/http/dashboard.server";
import { formatMoney } from "@/lib/format-currency";
import { portfolioSettlementLabel } from "@/lib/portfolio-settlement";
import Image from "next/image";
import Link from "next/link";

export default async function DashboardPortfolioPage() {
  let won: Awaited<ReturnType<typeof getServerMyPortfolio>> = [];
  let fetchError: string | null = null;
  try {
    won = await getServerMyPortfolio();
  } catch (e) {
    won = [];
    fetchError = e instanceof Error ? e.message : "Could not load portfolio.";
  }

  return (
    <div className="max-w-6xl">
      <h1 className="mb-2 font-headline text-4xl tracking-tight">Private collection</h1>
      <p className="mb-12 font-body text-sm text-on-surface-variant">
        Lots where you are the winning bidder after the hammer fell.
      </p>

      {fetchError ? (
        <div
          className="mb-8 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          role="alert"
        >
          {fetchError}
        </div>
      ) : null}

      {won.length === 0 && !fetchError ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-container-low/60 px-8 py-20 text-center shadow-sm ring-1 ring-outline-variant/10">
          <div
            className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-lowest font-headline text-3xl text-primary"
            aria-hidden
          >
            ◆
          </div>
          <h2 className="mb-3 font-headline text-2xl font-light text-on-surface">
            No acquired works yet
          </h2>
          <p className="mb-8 max-w-md font-body text-sm text-on-surface-variant">
            You haven&apos;t won any lots yet. Browse live auctions and place your best bid.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-gradient-to-br from-primary to-primary-container px-10 py-4 font-label text-xs font-bold uppercase tracking-[0.3em] text-on-primary shadow-sm transition-opacity hover:opacity-95"
          >
            Browse auctions
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {won.map((row) => {
            const a = row.lot;
            const img = a.images[0];
            const settlement = portfolioSettlementLabel(row);
            return (
              <li key={a.id}>
                <Link
                  href={`/dashboard/checkout/${a.id}`}
                  className="group block overflow-hidden rounded-lg bg-surface-container-lowest shadow-sm ring-1 ring-outline-variant/10 transition-shadow hover:shadow-md"
                >
                  <div className="relative aspect-[4/5] bg-surface-container-low">
                    {img ? (
                      <Image
                        src={img}
                        alt=""
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, 33vw"
                      />
                    ) : null}
                    <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-sm bg-white/90 px-2 py-1 backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                      <span className="font-label text-xs font-bold uppercase tracking-wider text-primary">
                        {settlement}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-headline text-xl font-light text-on-surface group-hover:italic">
                      {a.title}
                    </h3>
                    <p className="mt-2 font-label text-xs uppercase tracking-widest text-primary">
                      Hammer {formatMoney(a.currentPrice)}
                    </p>
                    <p className="mt-3 inline-flex items-center gap-1 font-label text-xs uppercase tracking-widest text-on-surface">
                      Complete purchase
                      <span className="material-symbols-outlined text-sm" aria-hidden>
                        arrow_forward
                      </span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
