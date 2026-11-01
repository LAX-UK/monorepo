import { FailedJobView } from "@/components/admin/failed-jobs/failed-job-view";
import { loadAdminFailedJobPage } from "@/lib/admin/failed-jobs/load-failed-job-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { FAILED_JOBS_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = metadataForPrivate(
  "Failed job",
  "One failed background job, what a retry does, and its history.",
);

export default async function AdminFailedJobPage({ params }: Props) {
  const { id } = await params;
  await requireAdminCapability(FAILED_JOBS_READ_ACCESS, `/admin/failed-jobs/${id}`);
  const page = await loadAdminFailedJobPage(id);
  if (!page) notFound();
  return <FailedJobView job={page.job} canAct={page.canAct} />;
}
