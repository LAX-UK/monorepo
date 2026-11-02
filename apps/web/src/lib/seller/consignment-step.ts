import type { ConsignmentRecord, ConsignmentTask } from "./consignment-records";

/** The words of each step a consignment can wait on its seller for. */
const TASK_STEP: Record<ConsignmentTask, { label: string; anchor: string }> = {
  changes: { label: "Make changes", anchor: "" },
  agreement: { label: "Review", anchor: "#agreement" },
  unsold: { label: "Choose", anchor: "#unsold" },
  reply: { label: "Read reply", anchor: "?tab=messages" },
};

/** The button's words for what a consignment waits on, shared by the list, Home and Notifications. */
export function consignmentStepLabel(task: ConsignmentTask): string {
  return TASK_STEP[task].label;
}

export type ConsignmentStep = { label: string; href: string; blockedReason: string | null };

/**
 * The one step a row offers: what waits on the member, else finishing a draft they can send.
 * While the account's state holds selling, the step stays in view, disabled, with the reason.
 */
export function consignmentStep(
  record: ConsignmentRecord,
  access: { canSell: boolean; pausedReason: string | null },
): ConsignmentStep | null {
  const blockedReason = access.pausedReason;
  if (record.task) {
    const step = TASK_STEP[record.task];
    return { label: step.label, href: `${record.href}${step.anchor}`, blockedReason };
  }
  if (record.status === "draft" && (access.canSell || blockedReason)) {
    return { label: "Continue", href: record.href, blockedReason };
  }
  return null;
}
