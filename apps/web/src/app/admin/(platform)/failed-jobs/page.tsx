import { FailedJobsList } from "@/components/admin/failed-jobs/failed-jobs-list";
import { buildFailedJobsChips } from "@/lib/admin/failed-jobs/failed-jobs-search";
import { loadAdminFailedJobsPage } from "@/lib/admin/failed-jobs/load-failed-jobs-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { FAILED_JOBS_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Failed jobs",
  "Background jobs that ran out of attempts, to retry or set aside.",
);

export default async function AdminFailedJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminCapability(FAILED_JOBS_READ_ACCESS, "/admin/failed-jobs");
  const sp = await searchParams;
  const { list, filters, filtered, canAct, pagination, loadError } =
    await loadAdminFailedJobsPage(sp);
  const queueLabels = new Map((list?.queues ?? []).map((queue) => [queue.id, queue.label]));
  const chips = buildFailedJobsChips(filters, sp, (id) => queueLabels.get(id) ?? id);

  return (
    <FailedJobsList
      list={list}
      search={sp}
      filters={filters}
      chips={chips}
      pagination={pagination}
      loadError={loadError}
      filtered={filtered}
      canAct={canAct}
    />
  );
}
