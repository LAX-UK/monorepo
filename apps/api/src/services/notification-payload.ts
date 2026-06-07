import { lotPath } from "@auction/types";
import type { NotificationPayload } from "./interfaces/notification-channel.js";
import type { CreateNotificationRow } from "./interfaces/notification-write.js";

export function notificationRowToPayload(row: CreateNotificationRow): NotificationPayload {
  return {
    type: row.type,
    title: row.title,
    message: row.message,
    lotId: row.lotId,
    submissionId: row.submissionId,
    ...(row.meta != null ? { meta: row.meta } : {}),
  };
}

/** Canonical marketing lot path when `meta.lotTitle` is present. */
export function notificationLotWebPath(payload: NotificationPayload): string | undefined {
  if (!payload.lotId || !payload.meta?.lotTitle) return undefined;
  return lotPath({ id: payload.lotId, title: payload.meta.lotTitle });
}

export function notificationLotTitle(payload: NotificationPayload): string {
  return payload.meta?.lotTitle ?? "Lot";
}

export function notificationSubmissionWebPath(
  payload: Pick<NotificationPayload, "submissionId">,
): string | undefined {
  if (!payload.submissionId) return undefined;
  return `/dashboard/submissions/${payload.submissionId}`;
}

export function notificationAdminSubmissionWebPath(
  payload: Pick<NotificationPayload, "submissionId" | "type">,
): string | undefined {
  if (!payload.submissionId || payload.type !== "submission_received_for_review") return undefined;
  return `/admin/submissions/${payload.submissionId}`;
}

const SELLER_SUBMISSION_FIRST_TYPES = new Set([
  "submission_approved",
  "submission_rejected",
  "submission_converted",
  "submission_draft_reminder",
]);

/** Best deep link for push/email/in-app actions (seller submission → lot → staff queue). */
export function notificationWebPath(payload: NotificationPayload): string | undefined {
  if (payload.submissionId && SELLER_SUBMISSION_FIRST_TYPES.has(payload.type)) {
    return notificationSubmissionWebPath(payload);
  }
  return (
    notificationLotWebPath(payload) ??
    notificationSubmissionWebPath(payload) ??
    notificationAdminSubmissionWebPath(payload)
  );
}
