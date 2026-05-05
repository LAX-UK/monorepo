import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

type Props = { params: Promise<{ saleId: string }> };

export default async function LiveSaleRoomPage({ params }: Props) {
  const { saleId } = await params;

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Live sale room"
        description={`Sale ${saleId.slice(0, 8)}… — streaming video, paddle state, and outsized bid controls arrive with Phase 3 bidder UX.`}
        className="border-0 pb-0"
      />
      <EmptyState
        title="Live console not connected"
        description="Use the marketing sale page for timed auctions today; hybrid clerk integrations will unlock this surface."
        action={
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-semibold uppercase tracking-widest text-on-primary"
          >
            Browse timed sales
          </Link>
        }
      />
    </div>
  );
}
