import "server-only";

import { buildSubmissionAssigneePresentation } from "@/lib/admin/submissions/submission-assignee-presentation";
import { getAdminUserById } from "@/lib/data/http/admin-users.server";
import { cache } from "react";

export type SubmissionAssigneeContext = {
  presentation: ReturnType<typeof buildSubmissionAssigneePresentation>;
  assigneeDisplayName: string | null;
  assigneeImage: string | null;
};

const getSubmissionAssigneeUser = cache(async (userId: string) => {
  return getAdminUserById(userId).catch(() => null);
});

export const loadSubmissionAssigneeContext = cache(
  async (
    assignedToUserId: string | null | undefined,
    currentUserId: string,
  ): Promise<SubmissionAssigneeContext> => {
    const userId = assignedToUserId?.trim() ? assignedToUserId.trim() : null;
    if (!userId) {
      return {
        presentation: buildSubmissionAssigneePresentation({
          assignedToUserId: null,
          currentUserId,
        }),
        assigneeDisplayName: null,
        assigneeImage: null,
      };
    }

    const user = await getSubmissionAssigneeUser(userId);
    const assigneeDisplayName = user?.name ?? null;
    const assigneeImage = user?.image ?? null;

    return {
      presentation: buildSubmissionAssigneePresentation({
        assignedToUserId: userId,
        currentUserId,
        assigneeDisplayName,
      }),
      assigneeDisplayName,
      assigneeImage,
    };
  },
);
