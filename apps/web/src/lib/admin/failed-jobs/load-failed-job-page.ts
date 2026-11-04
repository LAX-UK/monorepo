import "server-only";

import { getAdminFailedJob } from "@/lib/data/http/admin-failed-jobs.reader";

/** One failed job with what the signed-in person may do on it; null when there is no such job. */
export async function loadAdminFailedJobPage(id: string) {
  const job = await getAdminFailedJob(id);
  return job ? { job, canAct: job.canAct } : null;
}
