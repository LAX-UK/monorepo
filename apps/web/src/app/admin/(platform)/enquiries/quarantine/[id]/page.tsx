import { QuarantineMessageView } from "@/components/admin/enquiries/quarantine/quarantine-message-view";
import { enquiryAbilities } from "@/lib/admin/enquiries/enquiry-access";
import { QUARANTINE_COPY } from "@/lib/admin/enquiries/enquiry-email-copy";
import { loadQuarantineMessagePage } from "@/lib/admin/enquiries/load-quarantine-page";
import { quarantineHref } from "@/lib/admin/enquiries/quarantine.vm";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { ENQUIRIES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { UserRole } from "@auction/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = metadataForPrivate(
  QUARANTINE_COPY.meta.recordTitle,
  QUARANTINE_COPY.meta.recordDescription,
);

export default async function AdminEnquiryQuarantineMessagePage({ params }: Props) {
  const { id } = await params;
  const user = await requireAdminCapability(ENQUIRIES_ACCESS, quarantineHref(id));
  const page = await loadQuarantineMessagePage(id);
  if (page.kind === "not_found") notFound();
  if (page.kind !== "ready") {
    throw new Error(page.kind === "forbidden" ? "forbidden" : QUARANTINE_COPY.meta.unavailable);
  }
  const abilities = enquiryAbilities({ role: user.role as UserRole, staffRoles: user.staffRoles });
  return (
    <QuarantineMessageView
      message={page.message}
      canWork={abilities.canWork}
      now={new Date().toISOString()}
    />
  );
}
