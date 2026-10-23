import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader } from "@/components/account-ui";
import { AccountUnavailable } from "@/components/account-unavailable";
import { PortfolioNotices } from "@/components/portfolio-notices";
import { PortfolioWorkDetail } from "@/components/portfolio-work-detail";
import { loadPortfolioItems } from "@/server/application/load-portfolio-data";
import { buildSourceNotices } from "@/server/domain/portfolio-composition";
import { PORTFOLIO_ROUTES } from "@/server/domain/portfolio-routes";
import { buildWorkDetail, findWork } from "@/server/domain/portfolio-work-detail.vm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Work · LAX Account" };

/** Next may or may not have decoded the segment already, so a malformed escape falls back to the raw text. */
function tryDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * One work from the portfolio. When a product could not answer the work may simply be missing
 * from this load, so the page says so instead of a bare "not found".
 */
export default async function PortfolioWorkPage({
  params,
}: {
  params: Promise<{ product: string; id: string }>;
}) {
  const { product, id } = await params;
  const here = `${PORTFOLIO_ROUTES.overview}/${product}/${id}`;
  const loaded = await loadPortfolioItems();
  if (loaded.status === "unavailable") return <AccountUnavailable retryHref={here} />;
  if (loaded.status === "unsigned") redirect(`/api/auth/login?returnTo=${here}`);

  const item = findWork(loaded.rows, product, id) ?? findWork(loaded.rows, product, tryDecode(id));
  if (!item && loaded.complete) notFound();

  return (
    <AccountShell>
      <AccountPageHeader
        title="Work"
        backHref={PORTFOLIO_ROUTES.overview}
        backLabel="Back to portfolio"
      />
      <PortfolioNotices notices={buildSourceNotices(loaded, "items")} />
      {item ? (
        <PortfolioWorkDetail work={buildWorkDetail(item)} />
      ) : (
        <p className="text-sm text-on-surface-variant">
          We couldn't load this work right now. Please try again in a moment.
        </p>
      )}
    </AccountShell>
  );
}
