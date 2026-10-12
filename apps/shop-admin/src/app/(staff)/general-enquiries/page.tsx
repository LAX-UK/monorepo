import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminGeneralEnquiryRow } from "@auction/shop-contracts";

export default async function GeneralEnquiriesAdminPage() {
  const result = await fetchAdminJson<{ items: AdminGeneralEnquiryRow[] }>("general-enquiries");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-semibold">General enquiries</h1>
        <p className="text-sm text-on-surface-variant">
          Messages submitted from lax.art contact and editorial general-enquiry flows.
        </p>
      </div>
      {result.status !== "ok" ? (
        <p className="text-sm text-on-surface-variant">
          Could not load enquiries ({result.status}).
        </p>
      ) : result.data.items.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No general enquiries yet.</p>
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
                Subject {row.identitySubjectId}
                {row.phone ? ` · ${row.phone}` : ""}
                {row.contextSlug ? ` · ${row.contextSlug}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
