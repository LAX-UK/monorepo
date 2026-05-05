import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

type Props = { params: Promise<{ saleId: string }> };

export default async function AdminSaleroomSalePage({ params }: Props) {
  const { saleId } = await params;

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title={`Saleroom · ${saleId.slice(0, 8)}…`}
        description="Keyboard shortcuts, auctioneer high-contrast skin, and clerk_action persistence will populate this shell."
        className="border-0 pb-0"
      />
      <EmptyState
        title="Console scaffolding"
        description="Wire clerk bid ingress and broadcast channels against sale engine events."
        action={
          <Link
            href="/admin/saleroom"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-outline-variant/30 px-4 py-2 font-label text-xs uppercase tracking-widest"
          >
            Back to hub
          </Link>
        }
      />
    </div>
  );
}
