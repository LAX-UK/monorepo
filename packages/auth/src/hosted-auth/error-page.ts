import { buildHostedAuthHtml, escapeHostedHtml } from "./html.js";
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
    brand: view.brand,
    config: view.config,
    body: `<div class="auth-form">
      <a class="btn btn-primary" id="start-again" href="${escapeHostedHtml(view.config.restartUrl)}">Start again</a>
    </div>`,
  });
}
