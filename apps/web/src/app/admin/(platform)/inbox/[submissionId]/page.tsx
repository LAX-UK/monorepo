import { InboxThreadUnavailable } from "@/components/admin/consignment-inbox/inbox-thread-unavailable";
import { InboxThreadView } from "@/components/admin/consignment-inbox/inbox-thread-view";
import type { InboxSearchParams } from "@/lib/admin/consignment-inbox/inbox-list-state";
import { loadAdminInboxThreadPage } from "@/lib/admin/consignment-inbox/load-inbox-thread-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { CONSIGNMENT_INBOX_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { consignmentInboxAbilities } from "@auction/domain";
import type { UserRole } from "@auction/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Thread",
  "A client's messages about a consignment.",
);

export default async function AdminInboxThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<InboxSearchParams>;
}) {
  const { submissionId } = await params;
  const user = await requireAdminCapability(
    CONSIGNMENT_INBOX_READ_ACCESS,
    `/admin/inbox/${submissionId}`,
  );
  const model = await loadAdminInboxThreadPage(submissionId, await searchParams);
  if (model.kind === "not_found") notFound();
  if (model.kind !== "ready")
    return <InboxThreadUnavailable submissionId={submissionId} reason={model.kind} />;
  const abilities = consignmentInboxAbilities(user.role as UserRole, user.staffRoles);
  return (
    <InboxThreadView
      detail={model.detail}
      list={model.list}
      pager={model.pager}
      viewer={{
        userId: user.id,
        name: user.name || user.email,
        canManageSavedReplies: abilities.canManageSavedReplies,
      }}
    />
  );
}
