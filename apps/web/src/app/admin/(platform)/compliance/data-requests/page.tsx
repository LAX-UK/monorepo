import { DataRequestsList } from "@/components/admin/data-requests/data-requests-list";
import { buildDataRequestsChips } from "@/lib/admin/data-requests/data-requests-search";
import {
  KIND_FILTER_LABELS,
  PRODUCT_LABELS,
  STATUS_FILTER_LABELS,
} from "@/lib/admin/data-requests/data-requests.vm";
import { loadAdminDataRequestsPage } from "@/lib/admin/data-requests/load-data-requests-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { DATA_REQUESTS_MANAGE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { londonToday } from "@auction/staff-ui";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Data requests",
  "Requests for a copy of a person's data, with the legal due date of each.",
);

export default async function AdminDataRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminCapability(DATA_REQUESTS_MANAGE_ACCESS, "/admin/compliance/data-requests");
  const sp = await searchParams;
  const { list, summary, filters, filtered, pagination, loadError } =
    await loadAdminDataRequestsPage(sp);
  const chips = buildDataRequestsChips(filters, sp, {
    status: (value) => STATUS_FILTER_LABELS[value] ?? value,
    kind: (value) => KIND_FILTER_LABELS[value] ?? value,
    product: (value) => PRODUCT_LABELS[value as keyof typeof PRODUCT_LABELS] ?? value,
  });

  return (
    <DataRequestsList
      list={list}
      summary={summary}
      search={sp}
      filters={filters}
      chips={chips}
      pagination={pagination}
      loadError={loadError}
      filtered={filtered}
      today={londonToday()}
    />
  );
}
