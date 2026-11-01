import "server-only";

import { getAdminFailedJob } from "@/lib/data/http/admin-failed-jobs.reader";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { FAILED_JOBS_WRITE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

/** One failed job with what the signed-in person may do on it; null when there is no such job. */
export async function loadAdminFailedJobPage(id: string) {
  const [job, user] = await Promise.all([getAdminFailedJob(id), getServerSessionUser()]);
  if (!job) return null;
  return {
    job,
    canAct: user
      ? userHasAccessTo(user.role as UserRole, user.staffRoles, FAILED_JOBS_WRITE_ACCESS)
      : false,
  };
}
