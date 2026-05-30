"use client";

import { CatalogDeleteEligibilityNotice } from "@/components/admin/catalog/catalog-delete-eligibility-notice";
import { AdminLotOverviewPanel } from "@/components/admin/admin-lot-overview-panel";
import { useLotDetailReadiness } from "@/components/admin/lot-detail/lot-detail-readiness-context";
import { lotEditResumeHref } from "@/lib/admin/catalog-readiness";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import type { Lot } from "@auction/types";
import Link from "next/link";

type Props = {
  lotId: string;
  auction: Lot;
  context: LotDetailContext;
  bidCount: number | null;
};

export function LotOverviewTab({ lotId, auction, context, bidCount }: Props) {
  const readinessContext = useLotDetailReadiness();
  const imageAlts = auction.marketingDetails.imageAlts ?? [];
  const readiness = readinessContext?.publishReadiness ?? null;
  const showContinueEditing =
    auction.status === "draft" && readiness != null && readiness.percent < 100;
  const showDeleteBlockers =
    readinessContext?.canManageAuction &&
    (auction.status === "draft" || auction.status === "scheduled") &&
    (readinessContext.deleteBlockers?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      {showDeleteBlockers ? (
        <CatalogDeleteEligibilityNotice
          blockers={readinessContext?.deleteBlockers ?? []}
          entityLabel="lot"
        />
      ) : null}
      {showContinueEditing ? (
        <Link
          href={lotEditResumeHref(lotId, readiness)}
          className="block rounded-xl border border-primary/30 bg-primary/5 p-5 transition-colors hover:bg-primary/10"
        >
          <h3 className="font-headline text-base text-on-surface">Continue editing draft</h3>
          <p className="mt-2 font-body text-sm text-on-surface-variant">
            {readiness.completeCount} of {readiness.totalCount} publish checks complete — finish
            catalogue details before going live.
          </p>
          <span className="mt-3 inline-block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
            Edit lot →
          </span>
        </Link>
      ) : null}
      <AdminLotOverviewPanel
        lotId={lotId}
        auction={auction}
        imageAlts={imageAlts.filter(Boolean) as string[]}
        context={context}
        bidCount={bidCount}
      />
    </div>
  );
}
