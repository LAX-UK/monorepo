const NOT_A_MEMBER_MESSAGE =
  "You're no longer an active member of this organisation. Switch to a different organisation from the header.";

/** User-facing copy for known API error codes. Add entries here when the API gains new codes. */
const ERROR_CODE_MESSAGES = {
  missing_legal_entity_context:
    "We couldn't determine which organisation to load. Try switching organisation from the header and reloading.",
  not_a_member_of_legal_entity: NOT_A_MEMBER_MESSAGE,
  impersonation_session_expired:
    "Your impersonation session expired. End impersonation and try again.",
} as const satisfies Record<string, string>;

const ERROR_CODE_MESSAGES_LOOKUP: Readonly<Record<string, string>> = ERROR_CODE_MESSAGES;

const SESSION_EXPIRED_MESSAGE =
  "Your session expired. Sign in again to load the member list.";

/**
 * Maps HTTP status and optional API error code to stable dashboard copy.
 * Pure function — safe for unit tests without Next.js runtime.
 */
export function describeMemberFetchFailure(status: number, errorCode: string | null): string {
  const byCode = errorCode ? ERROR_CODE_MESSAGES_LOOKUP[errorCode] : undefined;
  if (byCode) {
    return byCode;
  }
  if (status === 401) {
    return SESSION_EXPIRED_MESSAGE;
  }
  if (status === 403) {
    return NOT_A_MEMBER_MESSAGE;
  }
  return `We couldn't fetch the member list (status ${status}${errorCode ? `, ${errorCode}` : ""}). Refresh to try again.`;
}
