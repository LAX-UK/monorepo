import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { generalEnquirySenderLabel } from "@/lib/general-enquiry-sender";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminGeneralEnquiryRow } from "@auction/shop-contracts";
import { EmptyState, PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

export const metadata = { title: "Enquiries" };

export default async function GeneralEnquiriesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<{
    items: AdminGeneralEnquiryRow[];
    nextCursor: string | null;
  }>(adminListPath("general-enquiries", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Enquiries" status={result.status} />;
  }

  return (
    <div>
      <PageHeader
        title="Enquiries"
        description="Messages sent from the lax.art contact page and editorial enquiry forms, newest first."
      />
      {result.data.items.length === 0 ? (
        <EmptyState
          headingLevel="h2"
          title="No enquiries yet"
          description="When a visitor writes to us from lax.art, their message will appear here."
        />
      ) : (
        <ul className="divide-y divide-border-hairline rounded-lg border border-border-hairline">
          {result.data.items.map((row) => (
            <li key={row.enquiryId} className="flex flex-col gap-2 px-4 py-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium capitalize text-on-surface">
                  {row.topic.replace(/_/g, " ")}
                </span>
                <time className="text-on-surface-variant" dateTime={row.createdAt}>
                  {new Date(row.createdAt).toLocaleString("en-GB")}
                </time>
              </div>
              <p className="text-on-surface-variant">{row.message}</p>
              <p className="text-xs text-on-surface-variant">
                {generalEnquirySenderLabel(row)}
                {row.phone ? ` · ${row.phone}` : ""}
                {row.contextSlug ? ` · ${row.contextSlug}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <AdminListCursorNav
        pathname="/general-enquiries"
        cursor={cursor}
        nextCursor={result.data.nextCursor}
      />
    </div>
  );
}
