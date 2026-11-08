import { DealView } from "@/components/admin/private-sales/deal-view";
import { loadAdminDealPage } from "@/lib/admin/private-sales/load-deal-page";
import { dealHref } from "@/lib/admin/private-sales/private-sales.vm";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { PRIVATE_SALE_DEALS_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ reference: string }> };

export const metadata: Metadata = metadataForPrivate(
  "Private sale",
  "One private sale: its stage, money, terms, parties and checks, and its history.",
);

export default async function AdminPrivateSalePage({ params }: Props) {
  const { reference } = await params;
  const ref = decodeURIComponent(reference);
  await requireAdminCapability(PRIVATE_SALE_DEALS_READ_ACCESS, `/admin/private-sales/${reference}`);
  const page = await loadAdminDealPage(ref);
  if (page.kind === "not_found") notFound();
  if (page.kind !== "ready") {
    throw new Error(
      page.kind === "forbidden" ? "forbidden" : "Private sale unavailable. Try again in a moment.",
    );
  }
  // The address people share is the reference, in capitals.
  if (page.deal.reference !== ref) redirect(dealHref(page.deal.reference));
  return <DealView deal={page.deal} />;
}
