import { buildHostedAuthHtml, escapeHostedHtml, viewChrome } from "./html.js";
import type { HostedAuthView } from "./view.js";

type HeaderReader = { get(name: string): string | null };

/**
 * True for a person following a link or typing a URL, false for fetch/XHR and API clients.
 * Both signals are required: `Accept: text/html` alone is sent by some fetch callers, and
 * `Sec-Fetch-Mode` is absent from non-browser clients, which must keep getting JSON.
 */
export function isBrowserNavigation(headers: HeaderReader): boolean {
  const accept = headers.get("accept") ?? "";
  return accept.includes("text/html") && headers.get("sec-fetch-mode") === "navigate";
}

type ErrorCopy = { title: string; message: string };

function errorCopy(status: number): ErrorCopy {
  if (status === 429) {
    return {
      title: "Too many attempts",
      message: "Wait a few minutes, then start again.",
    };
  }
  if (status === 401 || status === 403) {
    return {
      title: "We couldn't verify that request",
      message: "Your sign-in may have timed out. Start again to continue.",
    };
  }
  if (status === 404) {
    return {
      title: "We can't find that page",
      message: "The link may be out of date. Start again to continue.",
    };
  }
  if (status >= 500) {
    return {
      title: "Something went wrong on our side",
      message: "Nothing you did caused this. Start again in a moment.",
    };
  }
  return {
    title: "We couldn't complete that",
    message: "The link may have expired or already been used. Start again to get a new one.",
  };
}

/** Branded replacement for a raw JSON error shown to someone in a browser. */
export function buildHostedErrorHtml(status: number, view: HostedAuthView): string {
  const { title, message } = errorCopy(status);
  return buildHostedAuthHtml({
    title,
    description: message,
    ...viewChrome(view),
    showDestination: false,
    body: `<div class="auth-form">
      <a class="btn btn-primary" id="start-again" href="${escapeHostedHtml(view.config.restartUrl)}">Start again</a>
    </div>`,
  });
}

type LinkErrorKind =
  | "expired"
  | "already_linked"
  | "cancelled"
  | "mismatch"
  | "closed"
  | "failed"
  | "unknown";

/**
 * Every code the sign-in library or a provider sends when a link or provider round trip is
 * refused, grouped by what the person can do about it. Only these are ever acted on; any other
 * value, whatever it says, is treated as unknown.
 */
const LINK_ERROR_KINDS: Readonly<Record<string, Exclude<LinkErrorKind, "unknown">>> = {
  INVALID_TOKEN: "expired",
  EXPIRED_TOKEN: "expired",
  ATTEMPTS_EXCEEDED: "expired",
  payload_expired: "expired",
  account_already_linked_to_different_user: "already_linked",
  access_denied: "cancelled",
  user_cancelled_authorize: "cancelled",
  "email_doesn't_match": "mismatch",
  email_not_found: "mismatch",
  new_user_signup_disabled: "closed",
  signup_disabled: "closed",
  state_mismatch: "failed",
  state_not_found: "failed",
  please_restart_the_process: "failed",
  invalid_callback_request: "failed",
  no_code: "failed",
  invalid_code: "failed",
  oauth_code_verification_failed: "failed",
  oauth_provider_not_found: "failed",
  unable_to_get_user_info: "failed",
  unable_to_link_account: "failed",
  user_creation_failed: "failed",
};

const LINK_ERROR_COPY: Readonly<Record<LinkErrorKind, ErrorCopy>> = {
  expired: {
    title: "That link has expired",
    message: "It may have already been used. Start again to get a new one.",
  },
  already_linked: {
    title: "That account is already in use",
    message: "It belongs to a different LAX account. Use another one, or sign in to that account.",
  },
  cancelled: {
    title: "Nothing was changed",
    message: "The sign-in with your provider was cancelled. Start again when you're ready.",
  },
  mismatch: {
    title: "That account doesn't match",
    message: "The address on it isn't the one we expected. Start again with the right account.",
  },
  closed: {
    title: "We can't create an account that way",
    message: "Start again with an account you already have.",
  },
  failed: {
    title: "We couldn't finish that",
    message: "Nothing you did caused this. Start again in a moment.",
  },
  unknown: {
    title: "We couldn't complete that",
    message: "The link may have expired or already been used. Start again to get a new one.",
  },
};

/** The code if it is on the allow-list, otherwise null. Never returns anything taken from the input. */
export function knownLinkErrorCode(code: string | null | undefined): string | null {
  return typeof code === "string" && Object.hasOwn(LINK_ERROR_KINDS, code) ? code : null;
}

/** The page a refused link or provider round trip ends on, in words that fit the code. */
export function buildHostedLinkErrorHtml(
  code: string | null | undefined,
  view: HostedAuthView,
): string {
  const known = knownLinkErrorCode(code);
  const { title, message } =
    LINK_ERROR_COPY[known ? (LINK_ERROR_KINDS[known] ?? "unknown") : "unknown"];
  return buildHostedAuthHtml({
    title,
    description: message,
    ...viewChrome(view),
    showDestination: false,
    body: `<div class="auth-form">
      <a class="btn btn-primary" id="start-again" href="${escapeHostedHtml(view.config.restartUrl)}">Start again</a>
    </div>`,
  });
}
