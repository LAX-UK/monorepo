import { AdminFailedPage } from "@/components/admin-fetch-state";
import { EnquiriesList } from "@/components/enquiries/enquiries-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { enquiriesList, parseEnquiriesState } from "@/server/domain/enquiry-inbox.vm";
import type {
  AdminEnquiryAssigneesResponse,
  AdminEnquiryListResponse,
} from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Enquiries" };

const EMPTY: AdminEnquiryListResponse = {
  items: [],
  nextCursor: null,
  counts: { new: 0, in_progress: 0, closed: 0 },
};

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = parseEnquiriesState(await searchParams);
  const [result, session, assignees] = await Promise.all([
    fetchAdminJson<AdminEnquiryListResponse>(
      adminListPath("enquiries", {
        cursor: state.cursor,
        query: enquiriesList.apiQuery(state),
      }),
    ),
    loadAdminSession(),
    fetchAdminJson<AdminEnquiryAssigneesResponse>("enquiries/assignees"),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Enquiries" status={result.status} />;
  }
  if (session.status !== "ok") return <AdminFailedPage title="Enquiries" status="failed" />;

  return (
    <EnquiriesList
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      loadFailed={result.status === "failed"}
      currentSubject={session.data.subject}
      assignees={assignees.status === "ok" ? assignees.data.items : []}
      canWrite={session.data.capabilities.includes("enquiry.write")}
    />
  );
}
