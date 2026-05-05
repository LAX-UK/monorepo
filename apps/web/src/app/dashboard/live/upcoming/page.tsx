import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

export default function LiveBiddingHubPage() {
  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Live bidding"
        description="Follow sales with countdown timers, paddle status, and one-tap bidding once streaming integrates."
        className="border-0 pb-0"
      />
      <EmptyState
        title="No live sales linked yet"
        description="When you register for an onsite or hybrid auction, active rooms surface here with deep links like /dashboard/live/[saleId]."
        action={
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-semibold uppercase tracking-widest text-on-primary"
          >
            Browse sales
          </Link>
        }
      />
    </div>
  );
}
