import { EnquiryView } from "@/components/admin/enquiries/enquiry-view";
import { loadAdminEnquiryPage } from "@/lib/admin/enquiries/load-enquiry-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { MARKETING_ENQUIRIES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = metadataForPrivate(
  "Contact enquiry",
  "A message from the contact form: what the sender wrote, how to reach them, and whether it is handled.",
);

export default async function AdminEnquiryPage({ params }: Props) {
  const { id } = await params;
  await requireAdminCapability(MARKETING_ENQUIRIES_ACCESS, `/admin/enquiries/${id}`);
  const page = await loadAdminEnquiryPage(id);
  if (!page) notFound();
  return <EnquiryView enquiry={page.enquiry} canAct={page.canAct} />;
}
