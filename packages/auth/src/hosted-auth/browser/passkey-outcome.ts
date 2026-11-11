import {
  PASSKEY_LIMIT_ERROR_CODE,
  PASSKEY_NOT_ALLOWED,
  PASSKEY_USER_VERIFICATION_REQUIRED,
  PASSKEY_WRONG_PERSON,
  PLUGIN_CHALLENGE_NOT_FOUND,
  PLUGIN_PASSKEY_NOT_FOUND,
} from "../../passkey-error-codes.js";

/**
 * Why a passkey attempt did not finish, in the few words the pages have a sentence for. Nothing
 * here carries text from a device or a response, so no page can ever show it.
 */
export type PasskeyFailure =
  | "cancelled"
  | "not_recognised"
  | "not_verified"
  | "wrong_person"
  | "already_on_device"
  | "limit"
  | "expired"
  | "rate_limited"
  | "unsupported"
  | "unavailable";

/** What the browser threw: a library error (with a `code`), or a DOMException (with a `name`). */
type ThrownLike = { name?: unknown; code?: unknown; cause?: unknown };

function nameOf(error: unknown): string {
  const thrown = error as ThrownLike | null;
  return typeof thrown?.name === "string" ? thrown.name : "";
}

function codeOf(error: unknown): string {
  const thrown = error as ThrownLike | null;
  return typeof thrown?.code === "string" ? thrown.code : "";
}

/**
 * Reads what the browser threw when the device prompt did not complete. Closing the prompt, a
 * time-out and the person declining are all one thing to the person: nothing was used.
 */
export function failureFromBrowserError(error: unknown): PasskeyFailure {
  const names = [nameOf(error), nameOf((error as ThrownLike | null)?.cause)];
  const code = codeOf(error);
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" || names.includes("InvalidStateError")) {
    return "already_on_device";
  }
  if (code === "ERROR_CEREMONY_ABORTED" || names.includes("AbortError")) return "cancelled";
  if (names.includes("NotAllowedError")) return "cancelled";
  if (code === "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG") return "unsupported";
  if (names.includes("NotSupportedError")) return "unsupported";
  return "unavailable";
}

function codeOfBody(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

/** Reads the issuer's answer to a passkey call that was refused. */
export function failureFromResponse(status: number, body: unknown): PasskeyFailure {
  if (status === 429) return "rate_limited";
  const code = codeOfBody(body);
  switch (code) {
    case PASSKEY_USER_VERIFICATION_REQUIRED:
      return "not_verified";
    case PASSKEY_WRONG_PERSON:
      return "wrong_person";
    case PASSKEY_LIMIT_ERROR_CODE:
      return "limit";
    case PASSKEY_NOT_ALLOWED:
      return "expired";
    case PLUGIN_PASSKEY_NOT_FOUND:
      return "not_recognised";
    case PLUGIN_CHALLENGE_NOT_FOUND:
      return "unavailable";
    default:
      break;
  }
  if (status === 401 && code === "UNAUTHORIZED") return "expired";
  return "unavailable";
}
