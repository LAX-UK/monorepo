import {
  adminCancelAuctionAction,
  adminPublishAuctionAction,
} from "@/lib/actions/admin";
import { getAdminAuctionById } from "@/lib/data/http/admin.server";
import { getServerAuctionBids } from "@/lib/data/http/auctions.server";
import { DisplayHeading } from "@/components/ui/typography";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminAuctionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  const auction = await getAdminAuctionById(id).catch(() => null);
  if (!auction) notFound();

  let bids: Awaited<ReturnType<typeof getServerAuctionBids>> = [];
  try {
    bids = await getServerAuctionBids(id, 100);
  } catch {
    bids = [];
  }

  const canPublish = auction.status === "draft";
  const canCancel = auction.status === "draft" || auction.status === "scheduled" || auction.status === "active";

  return (
    <div className="max-w-4xl space-y-10">
      <Link href="/admin/auctions" className="font-label text-xs uppercase tracking-widest text-primary hover:underline">
        ← Auctions
      </Link>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {error}
        </div>
      ) : null}

      <div>
        <p className="font-label text-xs uppercase tracking-widest text-secondary">{auction.status}</p>
        <DisplayHeading as="h1" className="mt-2 text-4xl">
          {auction.title}
        </DisplayHeading>
        <p className="mt-4 font-body text-sm text-on-surface-variant">{auction.description ?? "—"}</p>
      </div>

      <div className="flex flex-wrap gap-4">
        {auction.status === "draft" ? (
          <Link
            href={`/admin/auctions/${id}/edit`}
            className="inline-flex items-center justify-center rounded-md border border-outline-variant/20 px-8 py-3 font-label text-xs font-semibold uppercase tracking-widest text-on-surface hover:bg-surface-container-low"
          >
            Edit draft
          </Link>
        ) : null}
        {canPublish ? (
          <form action={adminPublishAuctionAction}>
            <input type="hidden" name="auctionId" value={id} />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-container px-8 py-3 font-label text-xs font-semibold uppercase tracking-widest text-on-primary shadow-sm hover:opacity-95"
            >
              Publish
            </button>
          </form>
        ) : null}
        {canCancel ? (
          <form action={adminCancelAuctionAction}>
            <input type="hidden" name="auctionId" value={id} />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md border border-error/40 px-8 py-3 font-label text-xs font-semibold uppercase tracking-widest text-error hover:bg-error/10"
            >
              Cancel auction
            </button>
          </form>
        ) : null}
      </div>

      <section>
        <p className="mb-4 font-label text-xs font-semibold uppercase tracking-[0.3em] text-secondary">Bids</p>
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
