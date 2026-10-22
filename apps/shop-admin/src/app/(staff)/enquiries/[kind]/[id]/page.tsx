import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import {
  EnquiryContextSection,
  EnquiryMessage,
  EnquiryNotesThread,
  EnquirySenderSection,
} from "@/components/enquiries/enquiry-detail-sections";
import { EnquiryNoteForm } from "@/components/enquiries/enquiry-note-form.client";
import { EnquiryStatusBadge } from "@/components/enquiries/enquiry-status-badge";
import { EnquiryTriagePanel } from "@/components/enquiries/enquiry-triage-panel.client";
import { formatAdminDetailDateTime } from "@/lib/admin-detail-format";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import { enquiryContextLinks, enquiryDetailTitle } from "@/server/domain/enquiry-detail.vm";
import {
  ENQUIRY_LIST_PATH,
  ENQUIRY_TOPIC_LABELS,
  enquirySenderName,
  enquiryStaffName,
} from "@/server/domain/enquiry-inbox.vm";
import {
  type AdminEnquiryAssigneesResponse,
  type AdminEnquiryDetail,
  ENQUIRY_KINDS,
} from "@auction/shop-contracts";
import { PageHeader } from "@auction/ui";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Enquiry" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EnquiryDetailPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (!ENQUIRY_KINDS.some((known) => known === kind) || !UUID_PATTERN.test(id)) notFound();

  const [detailResult, sessionResult] = await Promise.all([
    fetchAdminJson<AdminEnquiryDetail>(`enquiries/${kind}/${id}`),
    loadAdminSession(),
  ]);
  if (detailResult.status === "unauthorized" || sessionResult.status === "unauthorized") {
    redirect("/login");
  }
  if (detailResult.status === "not_found") notFound();
  if (detailResult.status !== "ok" || sessionResult.status !== "ok") {
    return <AdminFailedPage title="Enquiry" status="failed" />;
  }

  const detail = detailResult.data;
  const session = sessionResult.data;
  const canWrite = session.capabilities.includes("enquiry.write");
  const assignees = canWrite
    ? await fetchAdminJson<AdminEnquiryAssigneesResponse>("enquiries/assignees")
    : null;
  if (canWrite && assignees?.status !== "ok") {
    return <AdminFailedPage title="Enquiry" status="failed" />;
  }

  const title = enquiryDetailTitle(detail, ENQUIRY_TOPIC_LABELS[detail.topic]);
  const contextLinks = enquiryContextLinks(
    detail,
    getShopAdminContainer().config.artPublicUrl ?? null,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs
            list={{ label: "Enquiries", href: ENQUIRY_LIST_PATH }}
            current={enquirySenderName(detail.sender)}
          />
        }
        title={title}
        meta={<EnquiryStatusBadge status={detail.status} />}
        description={`Received ${formatAdminDetailDateTime(detail.createdAt)}${
          detail.closedAt ? ` · Closed ${formatAdminDetailDateTime(detail.closedAt)}` : ""
        }`}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <EnquiryMessage message={detail.message} />
          <section aria-labelledby="enquiry-notes-heading" className="flex flex-col gap-4">
            <h2 id="enquiry-notes-heading" className="text-lg font-medium text-on-surface">
              Notes
            </h2>
            <EnquiryNotesThread notes={detail.notes} />
            {canWrite ? <EnquiryNoteForm kind={detail.kind} id={detail.id} /> : null}
          </section>
        </div>
        <aside aria-label="Enquiry details" className="flex min-w-0 flex-col gap-8">
          {canWrite && assignees?.status === "ok" ? (
            <EnquiryTriagePanel
              kind={detail.kind}
              id={detail.id}
              version={detail.version}
              status={detail.status}
              assignee={detail.assignee}
              assignees={assignees.data.items}
              currentSubject={session.subject}
              senderName={enquirySenderName(detail.sender)}
            />
          ) : (
            <section aria-labelledby="enquiry-handling-heading" className="flex flex-col gap-2">
              <h2 id="enquiry-handling-heading" className="text-lg font-medium text-on-surface">
                Handling
              </h2>
              <p className="text-sm text-on-surface">
                Assigned to {detail.assignee ? enquiryStaffName(detail.assignee) : "nobody yet"}.
              </p>
              <p className="text-sm text-on-surface-variant">
                Your role can read enquiries but not change them.
              </p>
            </section>
          )}
          <EnquirySenderSection sender={detail.sender} />
          <EnquiryContextSection links={contextLinks} />
        </aside>
      </div>
    </div>
  );
}
