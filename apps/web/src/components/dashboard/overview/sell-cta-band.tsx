import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

/** Slim seller CTA with editorial visual — replaces the three-column secondary stack. */
export function SellCtaBand({ vm }: { vm: DashboardOverviewVm }) {
  const href = vm.submissionsCount > 0 ? "/dashboard/submissions" : "/dashboard/submissions/new";
  const ctaLabel = vm.submissionsCount > 0 ? "View submissions" : "Start a submission";

  return (
    <Surface
      variant="quiet"
      padding="md"
      className="flex flex-col gap-4 overflow-hidden sm:flex-row sm:items-stretch sm:justify-between"
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center space-y-1">
        <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-lot-orange">
          Sell with LAX
        </p>
        <p className="font-body text-sm text-on-surface-variant">
          Submit photos, provenance, and condition notes for specialist review and cataloguing.
        </p>
        <Button className="mt-3 w-fit shrink-0 sm:mt-4" asChild>
          <Link href={href}>{ctaLabel}</Link>
        </Button>
      </div>
      <div
        className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-lot-orange/25 via-primary/15 to-surface-container-high sm:w-36 md:w-44"
        aria-hidden
      />
    </Surface>
  );
}
