import { AdminLotForm } from "@/components/admin/admin-lot-form";
import { lotToAdminLotFormValues } from "@/lib/forms/schemas/admin-lot-defaults";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminLotById } from "@/lib/data/http/admin.server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function AdminEditAuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auction = await getAdminLotById(id).catch(() => null);
  if (!auction) notFound();
  if (auction.status !== "draft") {
    redirect(`/admin/lots/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href={`/admin/lots/${id}`}
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Lot detail
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        Edit draft
      </DisplayHeading>

      <AdminLotForm mode="edit" lotId={id} defaultValues={lotToAdminLotFormValues(auction)} />
    </div>
  );
}
