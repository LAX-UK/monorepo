import { STEP_UP_COMPLETE_PATH } from "@/server/domain/account-reauth";

/** The only message the "Confirm it's you" window ever sends: a status, no token, no personal data. */
export const STEP_UP_MESSAGE_TYPE = "lax-step-up";

export const STEP_UP_COMPLETE_SCRIPT_PATH = `${STEP_UP_COMPLETE_PATH}/script`;

/** Never cached or stored: it only means something straight after the sign-in it ends. */
export const STEP_UP_COMPLETE_HEADERS = { "Cache-Control": "no-store" } as const;

/**
 * Runs in the window once the issuer has confirmed the person. It tells the Account page that
 * opened it, addressed to Account's own origin exactly, then closes. Without an opener (the
 * window lost it, or someone opened the address directly) it does nothing and the page's link
 * leads back to Account. Served as a file, so no inline script is needed.
 */
export const STEP_UP_COMPLETE_SCRIPT = `(function () {
  var origin = window.location.origin;
  var opener = window.opener;
  if (!opener || opener.closed) return;
  try {
    opener.postMessage({ type: ${JSON.stringify(STEP_UP_MESSAGE_TYPE)}, status: "ok" }, origin);
  } catch (e) {
    return;
  }
  window.close();
})();
`;

export function stepUpCompleteHtml(): string {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>Confirmed · LAX Account</title>
<script src="${STEP_UP_COMPLETE_SCRIPT_PATH}" defer></script>
</head>
<body>
<main>
<h1>You're confirmed</h1>
<p>You can close this window and carry on in LAX Account.</p>
<p><a href="/account/security">Back to LAX Account</a></p>
</main>
</body>
</html>
`;
}
