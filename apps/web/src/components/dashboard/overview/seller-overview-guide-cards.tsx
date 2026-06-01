import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { Surface } from "@auction/ui/components/surface";
import { FileStack, Layers, WalletCards } from "lucide-react";
import Link from "next/link";

const GUIDE_LINK_CLASS =
  "mt-3 inline-flex font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-4 hover:underline";

/** Full-width shortcuts into submissions, in-sale, and payouts. */
export function SellerOverviewGuideCards() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Surface variant="quiet" padding="md" className="flex gap-4">
        <FileStack className="size-10 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Submissions
          </p>
          <p className="mt-2 font-body text-sm text-on-surface-variant dark:text-on-surface-variant">
            Upload imagery, provenance, and pricing expectations. Specialists reply in the review
            queue.
          </p>
          <Link href="/dashboard/submissions" className={GUIDE_LINK_CLASS}>
            Open submissions
          </Link>
        </div>
      </Surface>
      <Surface variant="quiet" padding="md" className="flex gap-4">
        <Layers className="size-10 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Items in sale
          </p>
          <p className="mt-2 font-body text-sm text-on-surface-variant dark:text-on-surface-variant">
            Once converted, monitor catalogue status and public links without exposing bidder
            identities.
          </p>
          <Link href={DASHBOARD_ROUTES.sellerInSale} className={GUIDE_LINK_CLASS}>
            View items
          </Link>
        </div>
      </Surface>
      <Surface variant="quiet" padding="md" className="flex gap-4">
        <WalletCards className="size-10 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Payouts
          </p>
          <p className="mt-2 font-body text-sm text-on-surface-variant dark:text-on-surface-variant">
            Hammer, fees, and adjustments consolidate here as finance operations completes wiring.
          </p>
          <Link href={DASHBOARD_ROUTES.sellerPayouts} className={GUIDE_LINK_CLASS}>
            View payouts
          </Link>
        </div>
      </Surface>
    </section>
  );
}
