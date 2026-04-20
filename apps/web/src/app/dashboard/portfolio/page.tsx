import { PortfolioSearchBar } from "@/components/dashboard/portfolio-search";
import { Button } from "@/components/ui/button";
import { getServerMyPortfolio } from "@/lib/data/http/dashboard.server";
import { formatMoney } from "@/lib/format-currency";
import { portfolioSettlementLabel } from "@/lib/portfolio-settlement";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@auction/ui/components/card";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Image from "next/image";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function DashboardPortfolioPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const qRaw = (sp.q ?? "").trim().toLowerCase();

  let won: Awaited<ReturnType<typeof getServerMyPortfolio>> = [];
  let fetchError: string | null = null;
  try {
    won = await getServerMyPortfolio();
  } catch (e) {
    won = [];
    fetchError = e instanceof Error ? e.message : "Could not load portfolio.";
  }

  const filtered =
    qRaw.length === 0 ? won : won.filter((row) => row.lot.title.toLowerCase().includes(qRaw));

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Private collection"
        description="Lots where you are the winning bidder after the hammer fell."
        className="mb-6 border-0 pb-0"
      />

      {fetchError ? (
        <Alert variant="destructive" className="mb-8">
          <AlertTitle>Could not load portfolio</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      {!fetchError ? <PortfolioSearchBar initialQ={sp.q ?? ""} /> : null}

      {filtered.length === 0 && !fetchError ? (
        <EmptyState
          title={qRaw ? "No matches" : "No acquired works yet"}
          description={
            qRaw
              ? "Try a different search term."
              : "You haven't won any lots yet. Browse live auctions and place your best bid."
          }
          action={
            !qRaw ? (
              <Button variant="primary" asChild>
                <Link href="/">Browse auctions</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => {
            const a = row.lot;
            const img = a.images[0];
            const settlement = portfolioSettlementLabel(row);
            return (
              <li key={a.id}>
                <Card className="group h-full overflow-hidden p-0 transition-shadow hover:shadow-md">
                  <Link href={`/dashboard/checkout/${a.id}`} className="block">
                    <div className="relative aspect-[4/5] bg-surface-container-low">
                      {img ? (
                        <Image
                          src={img}
                          alt={`${a.title} — won lot artwork`}
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, 33vw"
                        />
                      ) : null}
                      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-sm bg-white/90 px-2 py-1 backdrop-blur-sm dark:bg-black/60">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                        <span className="font-label text-xs font-bold uppercase tracking-wider text-primary">
                          {settlement}
                        </span>
                      </div>
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className="font-headline text-xl font-light group-hover:italic">
                        {a.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="font-label text-xs uppercase tracking-widest text-primary">
                        Hammer {formatMoney(a.currentPrice)}
                      </p>
                    </CardContent>
                    <CardFooter className="pt-0">
                      <p className="inline-flex items-center gap-1 font-label text-xs uppercase tracking-widest text-on-surface">
                        Complete purchase
                        <span className="material-symbols-outlined text-sm" aria-hidden>
                          arrow_forward
                        </span>
                      </p>
                    </CardFooter>
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
