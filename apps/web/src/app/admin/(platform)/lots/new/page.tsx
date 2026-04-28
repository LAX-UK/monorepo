import { AdminLotForm } from "@/components/admin/admin-lot-form";
import { DisplayHeading } from "@/components/ui/typography";
import { emptyAdminLotFormValues } from "@/lib/forms/schemas/admin-lot-defaults";
import Link from "next/link";

export default function AdminNewAuctionPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href="/admin/lots"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Auctions
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        New auction
      </DisplayHeading>

      <AdminLotForm mode="create" defaultValues={emptyAdminLotFormValues()} />
    </div>
  );
}
