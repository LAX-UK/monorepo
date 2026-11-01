import { DisputeCaseView } from "@/components/admin/disputes/dispute-case-view";
import { loadAdminDisputeCasePage } from "@/lib/admin/finance/load-dispute-case-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = metadataForPrivate(
  "Dispute",
  "A card dispute, its deadline and how it falls on the invoices.",
);

export default async function AdminDisputeCasePage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminDisputeCasePage(id);
  if (!page) notFound();

  return (
    <DisputeCaseView
      found={page.found}
      nowIso={page.nowIso}
      canAllocate={page.canAllocate}
      canOpenClient={page.canOpenClient}
    />
  );
}
