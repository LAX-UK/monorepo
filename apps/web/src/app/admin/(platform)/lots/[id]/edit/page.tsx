import { AdminLotForm } from "@/components/admin/admin-lot-form";
import { AdminLotMarketingForm } from "@/components/admin/admin-lot-marketing-form";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminLotById } from "@/lib/data/http/admin.server";
import { lotToAdminLotFormValues } from "@/lib/forms/schemas/admin-lot-defaults";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function AdminEditAuctionPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auction = await getAdminLotById(id).catch(() => null);
  if (!auction) notFound();
  if (auction.status === "ended" || auction.status === "cancelled") {
    redirect(`/admin/lots/${id}`);
  }

  const isDraft = auction.status === "draft";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href={`/admin/lots/${id}`}
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Lot detail
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        {isDraft ? "Edit draft" : "Edit catalog copy"}
      </DisplayHeading>
      {isDraft ? null : (
        <p className="font-body text-sm text-on-surface-variant">
          Core auction fields (price, times) are locked after publish. You can still update
          condition, provenance, exhibitions, and the artist note below.
        </p>
      )}

      {isDraft ? (
        <AdminLotForm mode="edit" lotId={id} defaultValues={lotToAdminLotFormValues(auction)} />
      ) : null}
      <AdminLotMarketingForm lotId={id} marketingDetails={auction.marketingDetails} />
    </div>
  );
}
