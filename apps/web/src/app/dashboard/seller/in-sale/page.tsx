import { Button } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSaleWithLots } from "@/lib/data/http/sales.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import type { Lot } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Card, CardContent } from "@auction/ui/components/card";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  type InSaleDisplayRow,
  SELLER_LOT_FILTER_OPTIONS,
  type SellerLotStatusFilter,
  filterInSaleRows,
  inSaleFilterHref,
  parseSellerLotStatusFilter,
  sortInSaleRows,
  toInSaleDisplayRows,
} from "./in-sale.vm";

const PAGE_PATH = "/dashboard/seller/in-sale";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

function badgeVariant(tone: InSaleDisplayRow["statusTone"]) {
  switch (tone) {
    case "success":
      return "success" as const;
    case "danger":
      return "danger" as const;
    case "info":
      return "info" as const;
    case "neutral":
      return "neutral" as const;
  }
}

function FilterChips({ active }: { active: SellerLotStatusFilter }) {
  return (
    <nav aria-label="Filter lots by status" className="flex flex-wrap gap-2">
      {SELLER_LOT_FILTER_OPTIONS.map((opt) => {
        const isActive = opt.value === active;
        return (
          <Link
            key={opt.value}
            href={inSaleFilterHref(PAGE_PATH, opt.value)}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-xs font-semibold uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              isActive
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ReserveBadge({ row }: { row: InSaleDisplayRow }) {
  if (row.reserveLabel === "No reserve") {
    return (
      <span className="text-xs text-on-surface-variant" title="No reserve set">
        {row.reserveLabel}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
        row.reserveMet ? "bg-success/10 text-success" : "bg-error/10 text-error"
      }`}
    >
      {row.reserveLabel}
    </span>
  );
}

function InSaleRowCard({ row }: { row: InSaleDisplayRow }) {
  return (
    <li>
      <Card>
        <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center">
          <div className="font-mono text-xs text-on-surface-variant tabular-nums sm:min-w-12">
            {row.lotNumberLabel}
          </div>
          <div className="min-w-0">
            <Link
              href={row.lotHref}
              className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {row.title}
            </Link>
            {row.saleTitle && row.saleHref ? (
              <p className="text-xs text-on-surface-variant">
                In{" "}
                <Link
                  href={row.saleHref}
                  className="underline underline-offset-2 hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {row.saleTitle}
                </Link>
                {" · ends "}
                <time dateTime={row.endTimeIso}>{row.endTimeLabel}</time>
              </p>
            ) : (
              <p className="text-xs text-on-surface-variant">
                Ends <time dateTime={row.endTimeIso}>{row.endTimeLabel}</time>
              </p>
            )}
          </div>
          <div className="text-right text-base font-semibold tabular-nums">
            {row.currentPriceLabel}
          </div>
          <div className="flex items-center justify-end">
            <ReserveBadge row={row} />
          </div>
          <div className="flex items-center justify-end">
            <StatusBadge variant={badgeVariant(row.statusTone)} size="sm">
              {row.statusLabel}
            </StatusBadge>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

async function loadSaleLookup(
  saleIds: string[],
): Promise<Map<string, { id: string; title: string }>> {
  const map = new Map<string, { id: string; title: string }>();
  if (saleIds.length === 0) return map;
  const results = await Promise.all(saleIds.map((id) => getServerSaleWithLots(id)));
  for (const result of results) {
    if (result) map.set(result.sale.id, { id: result.sale.id, title: result.sale.title });
  }
  return map;
}

export default async function SellerInSalePage({ searchParams }: PageProps) {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: PAGE_PATH,
  });
  const { acting } = await resolveActingContext(user.role, user.staffRole ?? null);
  if (!acting) redirect("/dashboard");

  const sp = await searchParams;
  const filter = parseSellerLotStatusFilter(sp.status);

  const lotReader = await getServerLotReader();
  let lots: Lot[] = [];
  let fetchError: string | null = null;
  try {
    lots = await lotReader.list({ sellerId: acting.id, limit: 100 });
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Could not load your lots.";
  }

  const saleIds = Array.from(
    new Set(lots.map((lot) => lot.saleId).filter((id): id is string => Boolean(id))),
  );
  const saleLookup = await loadSaleLookup(saleIds).catch(() => new Map());
  const allDisplay = sortInSaleRows(toInSaleDisplayRows(lots, saleLookup));
  const filtered = filterInSaleRows(allDisplay, filter);

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Items in sale"
        description="Lots from your submissions across every catalogue. Status, reserve, and end time at a glance — bidder identities are never shown."
        className="border-0 pb-0"
      />

      <FilterChips active={filter} />

      {fetchError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load your lots</AlertTitle>
          <AlertDescription>
            {fetchError} Refresh the page or try again in a few minutes.
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-live="polite" aria-busy="false">
        {!fetchError && allDisplay.length === 0 ? (
          <EmptyState
            title="No lots yet"
            description="Once your submissions are approved and added to a sale, they will appear here. Start by submitting your first work."
            action={
              <Button variant="primary" asChild>
                <Link href="/dashboard/submissions/new">Submit your first work</Link>
              </Button>
            }
          />
        ) : null}

        {!fetchError && allDisplay.length > 0 && filtered.length === 0 ? (
          <EmptyState
            title="No lots match this filter"
            description="Your approved submissions will appear here once we schedule them into a sale."
            action={
              <Button variant="secondary" asChild>
                <Link href={PAGE_PATH}>Show live & scheduled</Link>
              </Button>
            }
          />
        ) : null}

        {filtered.length > 0 ? (
          <ul className="space-y-3">
            {filtered.map((row) => (
              <InSaleRowCard key={row.id} row={row} />
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
