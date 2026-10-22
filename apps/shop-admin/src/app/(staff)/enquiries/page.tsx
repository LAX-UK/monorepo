import { AdminFailedPage } from "@/components/admin-fetch-state";
import { EnquiryInbox } from "@/components/enquiries/enquiry-inbox.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { enquiryInboxApiQuery, parseEnquiryInboxQuery } from "@/server/domain/enquiry-inbox.vm";
import type { AdminEnquiryListResponse } from "@auction/shop-contracts";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

export const metadata = { title: "Enquiries" };

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseEnquiryInboxQuery(await searchParams);
  const result = await fetchAdminJson<AdminEnquiryListResponse>(
    adminListPath("enquiries", { query: enquiryInboxApiQuery(query) }),
  );
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Enquiries" status={result.status} />;
  }

  return (
    <div>
      <PageHeader
        title="Enquiries"
        description="Messages from lax.art and questions about artworks. Pick one up, keep notes, and close it when it is dealt with."
      />
      <EnquiryInbox query={query} page={result.data} />
    </div>
  );
}
