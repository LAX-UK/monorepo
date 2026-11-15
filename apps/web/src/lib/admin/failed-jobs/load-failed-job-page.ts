import "server-only";

import { getAdminFailedJob } from "@/lib/data/http/admin-failed-jobs.reader";
import type { StaffRoles, UserRole } from "@auction/types";
import { payloadRecordHrefs } from "./failed-job-record-links";

/**
 * One failed job with what the signed-in person may do on it, and the admin page of each record
 * its payload names (where they may open it); null when there is no such job.
 */
export async function loadAdminFailedJobPage(
  id: string,
  viewer: { role: UserRole; staffRoles: StaffRoles | undefined },
) {
  const job = await getAdminFailedJob(id);
  if (!job) return null;
  return {
    job,
    canAct: job.canAct,
    recordHrefs: payloadRecordHrefs(job.payload, viewer.role, viewer.staffRoles),
  };
}
