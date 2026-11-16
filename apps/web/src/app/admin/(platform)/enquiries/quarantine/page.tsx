import { QuarantineList } from "@/components/admin/enquiries/quarantine/quarantine-list";
import { loadQuarantineListPage } from "@/lib/admin/enquiries/load-quarantine-page";
import { QUARANTINE_PATH } from "@/lib/admin/enquiries/quarantine.vm";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { ENQUIRIES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Held email",
  "Email sent to enquiry reply addresses that could not be matched safely, for staff to review.",
);

export default async function AdminEnquiryQuarantinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminCapability(ENQUIRIES_ACCESS, QUARANTINE_PATH);
  const model = await loadQuarantineListPage(await searchParams);
  return (
    <QuarantineList
      page={model.page}
      view={model.view}
      nextHref={model.nextHref}
      firstHref={model.firstHref}
      loadError={model.loadError}
      now={new Date().toISOString()}
    />
  );
}
