import { InboxStaffList } from "@/components/admin/consignment-inbox/inbox-staff-list";
import type { InboxSearchParams } from "@/lib/admin/consignment-inbox/inbox-list-state";
import { loadAdminInboxListPage } from "@/lib/admin/consignment-inbox/load-inbox-list-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { CONSIGNMENT_INBOX_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { consignmentInboxAbilities } from "@auction/domain";
import type { UserRole } from "@auction/types";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Inbox",
  "Client messages about consignments, longest waiting first.",
);

export default async function AdminInboxPage({
  searchParams,
}: { searchParams: Promise<InboxSearchParams> }) {
  const user = await requireAdminCapability(CONSIGNMENT_INBOX_READ_ACCESS, "/admin/inbox");
  const model = await loadAdminInboxListPage(await searchParams);
  const abilities = consignmentInboxAbilities(user.role as UserRole, user.staffRoles);
  return (
    <InboxStaffList
      state={model.state}
      list={model.list}
      summary={model.summary}
      loadError={model.loadError}
      viewer={{
        userId: user.id,
        canReply: abilities.canReply,
        canManageSavedReplies: abilities.canManageSavedReplies,
      }}
    />
  );
}
