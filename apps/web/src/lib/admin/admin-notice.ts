/**
 * What a staff page says after an action redirected back to it. The redirect carries one of
 * these codes, never text, so a crafted link cannot put its own words on a staff page. Every
 * message is fixed here; an unknown code shows nothing.
 */
export const ADMIN_NOTICES = {
  transition_applied: { tone: "success", message: "Transition applied." },
  entity_rejected: { tone: "success", message: "Entity rejected." },
  entity_archived: { tone: "success", message: "Entity archived." },
  invalid_entity_id: { tone: "error", message: "Enter a valid legal entity ID." },
  invalid_request: { tone: "error", message: "The request was not valid. Try again." },
  entity_missing: { tone: "error", message: "The entity was not found." },
  reject_confirmation_mismatch: {
    tone: "error",
    message: "Type REJECT exactly to confirm rejection.",
  },
  archive_confirmation_mismatch: {
    tone: "error",
    message: "Type the confirmation phrase shown exactly to confirm archiving.",
  },
  reason_too_short: { tone: "error", message: "Reason must be at least 3 characters." },
  not_permitted: { tone: "error", message: "Your role does not allow this change." },
  conflict: {
    tone: "error",
    message: "The entity is not in a state that allows this change. Refresh and check its status.",
  },
  action_failed: {
    tone: "error",
    message: "The change could not be applied. Try again, or contact support if it persists.",
  },
} as const;

export type AdminNoticeCode = keyof typeof ADMIN_NOTICES;
export type AdminNoticeTone = (typeof ADMIN_NOTICES)[AdminNoticeCode]["tone"];

export const ADMIN_NOTICE_PARAM = "notice";

export function isAdminNoticeCode(value: unknown): value is AdminNoticeCode {
  return typeof value === "string" && Object.hasOwn(ADMIN_NOTICES, value);
}

export type ResolvedAdminNotice = { success: string | null; error: string | null };

const NO_NOTICE: ResolvedAdminNotice = { success: null, error: null };

/** Maps a `?notice=` value to fixed copy; anything that is not a known code resolves to nothing. */
export function resolveAdminNotice(
  value: string | string[] | undefined | null,
): ResolvedAdminNotice {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!isAdminNoticeCode(raw)) return NO_NOTICE;
  const { tone, message } = ADMIN_NOTICES[raw];
  return tone === "success" ? { success: message, error: null } : { success: null, error: message };
}

/** The notice code for a failed API call, by status. */
export function adminNoticeCodeForStatus(status: number): AdminNoticeCode {
  if (status === 403) return "not_permitted";
  if (status === 404) return "entity_missing";
  if (status === 409) return "conflict";
  return "action_failed";
}
