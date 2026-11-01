import { SavedRepliesStaffList } from "@/components/admin/consignment-inbox/saved-replies-staff-list";
import { loadAdminSavedRepliesListPage } from "@/lib/admin/consignment-inbox/load-saved-replies-list-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { CONSIGNMENT_INBOX_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { consignmentInboxAbilities } from "@auction/domain";
import type { UserRole } from "@auction/types";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Saved replies",
  "The team's replies for common client questions.",
);

export default async function AdminSavedRepliesPage() {
  const user = await requireAdminCapability(
    CONSIGNMENT_INBOX_READ_ACCESS,
    "/admin/inbox/saved-replies",
  );
  const model = await loadAdminSavedRepliesListPage();
  const abilities = consignmentInboxAbilities(user.role as UserRole, user.staffRoles);
  return (
    <SavedRepliesStaffList
      replies={model.replies}
      loadError={model.loadError}
      canManage={abilities.canManageSavedReplies}
    />
  );
}
