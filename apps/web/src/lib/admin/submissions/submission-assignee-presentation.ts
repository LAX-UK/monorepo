export type SubmissionAssigneePresentation = {
  userId: string | null;
  label: string;
  isCurrentUser: boolean;
  isUnassigned: boolean;
};

export function buildSubmissionAssigneePresentation(input: {
  assignedToUserId: string | null | undefined;
  currentUserId: string;
  assigneeDisplayName?: string | null;
}): SubmissionAssigneePresentation {
  const userId = input.assignedToUserId?.trim() ? input.assignedToUserId.trim() : null;
  if (!userId) {
    return {
      userId: null,
      label: "Unassigned",
      isCurrentUser: false,
      isUnassigned: true,
    };
  }
  if (userId === input.currentUserId) {
    return {
      userId,
      label: "You",
      isCurrentUser: true,
      isUnassigned: false,
    };
  }
  return {
    userId,
    label: input.assigneeDisplayName?.trim() || "Assigned",
    isCurrentUser: false,
    isUnassigned: false,
  };
}
