import { EnquiryView } from "@/components/admin/enquiries/enquiry-view";
import { enquiryHref } from "@/lib/admin/enquiries/enquiries-search";
import { enquiryAbilities } from "@/lib/admin/enquiries/enquiry-access";
import { loadAdminEnquiryPage } from "@/lib/admin/enquiries/load-enquiry-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { ENQUIRIES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { UserRole } from "@auction/types";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ reference: string }> };

export const metadata: Metadata = metadataForPrivate(
  "Enquiry",
  "One enquiry: what the client wrote, who has it, its notes and its history.",
);

export default async function AdminEnquiryPage({ params }: Props) {
  const { reference } = await params;
  const ref = decodeURIComponent(reference);
  const user = await requireAdminCapability(ENQUIRIES_ACCESS, `/admin/enquiries/${reference}`);
  const page = await loadAdminEnquiryPage(ref);
  if (page.kind === "not_found") notFound();
  if (page.kind !== "ready") {
    throw new Error(
      page.kind === "forbidden" ? "forbidden" : "Enquiry unavailable. Try again in a moment.",
    );
  }
  // Links from the work inbox carry the id; the address people share is the reference.
  if (page.enquiry.reference !== ref) redirect(enquiryHref(page.enquiry.reference));
  const abilities = enquiryAbilities({ role: user.role as UserRole, staffRoles: user.staffRoles });
  return (
    <EnquiryView
      enquiry={page.enquiry}
      assignees={page.assignees}
      viewerId={user.id}
      canWork={abilities.canWork}
      now={new Date().toISOString()}
    />
  );
}
