import { AdminLotDetailActions } from "@/components/admin/admin-lot-detail-actions";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminLotById } from "@/lib/data/http/admin.server";
import { getServerLotBids } from "@/lib/data/http/lots.server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminAuctionDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auction = await getAdminLotById(id).catch(() => null);
  if (!auction) notFound();

  let bids: Awaited<ReturnType<typeof getServerLotBids>> = [];
  try {
    bids = await getServerLotBids(id, 100);
  } catch {
    bids = [];
  }

  const canPublish = auction.status === "draft";
  const canCancel =
    auction.status === "draft" || auction.status === "scheduled" || auction.status === "active";

  return (
    <div className="max-w-4xl space-y-10">
      <Link
        href="/admin/lots"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Auctions
      </Link>

      <div>
        <p className="font-label text-xs uppercase tracking-widest text-secondary">
          {auction.status}
        </p>
        <DisplayHeading as="h1" className="mt-2 text-4xl">
          {auction.title}
        </DisplayHeading>
        <p className="mt-4 font-body text-sm text-on-surface-variant">
          {auction.description ?? "—"}
        </p>
      </div>

      <AdminLotDetailActions
        lotId={id}
        canPublish={canPublish}
        canCancel={canCancel}
        showEditDraft={auction.status === "draft"}
      />

      <section>
        <p className="mb-4 font-label text-xs font-semibold uppercase tracking-[0.3em] text-secondary">
          Bids
        </p>
        {bids.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No bids yet.</p>
        ) : (
          <ul className="space-y-2 rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4">
            {bids.map((b) => (
              <li key={b.id} className="flex justify-between font-body text-sm">
                <span>{b.amount}</span>
                <span className="text-on-surface-variant">{b.bidderId.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
