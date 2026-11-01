import { SubmissionMessagesTab } from "@/components/admin/submission-detail/tabs/messages-tab";
import { loadAdminSubmissionMessagesPage } from "@/lib/admin/submissions/load-submission-messages-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { CONSIGNMENT_INBOX_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { consignmentInboxAbilities } from "@auction/domain";
import type { UserRole } from "@auction/types";
import { notFound } from "next/navigation";

export default async function AdminSubmissionMessagesPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdminCapability(
    CONSIGNMENT_INBOX_READ_ACCESS,
    `/admin/submissions/${id}/messages`,
  );
  const model = await loadAdminSubmissionMessagesPage(id);
  if (model.kind === "not_found") notFound();
  // The tab's error boundary keeps the consignment's header and tabs and offers Try again.
  if (model.kind === "unavailable") throw new Error("The messages service did not answer");
  const abilities = consignmentInboxAbilities(user.role as UserRole, user.staffRoles);
  return (
    <SubmissionMessagesTab
      detail={model.detail}
      viewer={{
        userId: user.id,
        name: user.name || user.email,
        canManageSavedReplies: abilities.canManageSavedReplies,
      }}
    />
  );
}
