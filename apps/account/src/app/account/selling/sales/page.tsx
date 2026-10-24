import { AccountShell } from "@/components/account-shell";
import { SellingPageHeader, openSellingPage } from "@/components/selling/selling-page";
import {
  SellingListSkeleton,
  SellingLoadError,
  SellingStatsSkeleton,
} from "@/components/selling/selling-parts";
import { SellingSales } from "@/components/selling/selling-sales";
import { loadSalesSection } from "@/server/application/load-selling-sections";
import { SELLING_ROUTES } from "@/server/domain/selling/selling-routes";
import { type SalesPeriod, parseSalesPeriod } from "@/server/domain/selling/selling-sales.vm";
import type { SessionHandle } from "@/server/ports/portfolio-gateway";
import type { Metadata } from "next";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sales · LAX Account" };

async function SalesSection({ handle, period }: { handle: SessionHandle; period: SalesPeriod }) {
  const loaded = await loadSalesSection(handle, period);
  if (loaded.status === "unavailable") {
    return (
      <SellingLoadError title="We couldn't load your sales" retryHref={SELLING_ROUTES.sales} />
    );
  }
  return <SellingSales page={loaded.view} />;
}

/** The sales statement: each edition sold, the LAX fees, what the person is paid, and when. */
export default async function SellingSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [opened, params] = await Promise.all([openSellingPage("sales"), searchParams]);
  if ("unavailable" in opened) return opened.unavailable;
  const period = parseSalesPeriod(params.period);
  return (
    <AccountShell width="wide">
      <SellingPageHeader
        ready={opened.ready}
        tool="sales"
        title="Sales"
        description="Each edition you sold, the LAX fees, what you're paid and when."
      />
      <Suspense
        key={period}
        fallback={
          <div className="flex flex-col gap-8">
            <SellingStatsSkeleton label="Loading your sales" />
            <SellingListSkeleton rows={4} label="Loading your sales" />
          </div>
        }
      >
        <SalesSection handle={opened.ready.handle} period={period} />
      </Suspense>
    </AccountShell>
  );
}
