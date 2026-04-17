import { DisplayHeading } from "@/components/ui/typography";
import { getAdminAuctionList, getAdminPaymentList } from "@/lib/data/http/admin.server";
import Link from "next/link";

const btnPrimary =
  "inline-flex items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-container px-10 py-4 font-label text-xs font-semibold uppercase tracking-[0.3em] text-on-primary shadow-sm transition-opacity hover:opacity-95";
const btnSecondary =
  "inline-flex items-center justify-center rounded-md border border-outline-variant/20 bg-transparent px-10 py-4 font-label text-xs font-semibold uppercase tracking-[0.3em] text-on-surface transition-colors hover:bg-surface-container-low";

export default async function AdminHomePage() {
  let draftCount = 0;
  let activeCount = 0;
  let paymentCount = 0;
  try {
    const [drafts, active, payments] = await Promise.all([
      getAdminAuctionList({ status: "draft", limit: 100 }),
      getAdminAuctionList({ status: "active", limit: 100 }),
      getAdminPaymentList(),
    ]);
    draftCount = drafts.length;
    activeCount = active.length;
    paymentCount = payments.length;
  } catch {
    // overview still renders; cards show zeros
  }

  return (
    <div className="max-w-4xl space-y-10">
      <DisplayHeading as="h1" className="text-4xl md:text-5xl">
        Operations
      </DisplayHeading>
      <p className="font-body text-on-surface-variant">
        Create and publish lots, review settlements, and process refunds when needed.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-container-low p-6 ring-1 ring-outline-variant/10">
          <p className="font-label text-xs uppercase tracking-widest text-secondary">Draft lots</p>
          <p className="mt-2 font-headline text-3xl text-on-surface">{draftCount}</p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-6 ring-1 ring-outline-variant/10">
          <p className="font-label text-xs uppercase tracking-widest text-secondary">Live lots</p>
          <p className="mt-2 font-headline text-3xl text-on-surface">{activeCount}</p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-6 ring-1 ring-outline-variant/10">
          <p className="font-label text-xs uppercase tracking-widest text-secondary">
            Payment rows
          </p>
          <p className="mt-2 font-headline text-3xl text-on-surface">{paymentCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <Link href="/admin/auctions/new" className={btnPrimary}>
          New auction
        </Link>
        <Link href="/admin/auctions" className={btnSecondary}>
          All auctions
        </Link>
        <Link href="/admin/payments" className={btnSecondary}>
          Payments
        </Link>
      </div>
    </div>
  );
}
