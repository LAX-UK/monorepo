import { STEP_UP_COMPLETE_PATH } from "@/server/domain/account-reauth";

/** The only message the "Confirm it's you" window ever sends: a status, no token, no personal data. */
export const STEP_UP_MESSAGE_TYPE = "lax-step-up";

/**
 * What the window says. `ok`: the issuer confirmed the person signed in to Account. `signed_out`:
 * nobody is signed in to Account any more, so there was nobody to confirm; the page then signs in
 * on a full page instead of running anything again.
 */
export const STEP_UP_ANSWERS = ["ok", "signed_out"] as const;
export type StepUpAnswer = (typeof STEP_UP_ANSWERS)[number];

/** The query parameter of the completion page (and its script) that names the answer. */
export const STEP_UP_STATUS_QUERY = "status";

/** One of the fixed answers, or null for anything else. */
export function parseStepUpAnswer(value: unknown): StepUpAnswer | null {
  return (STEP_UP_ANSWERS as readonly unknown[]).includes(value) ? (value as StepUpAnswer) : null;
}

/** The completion page's answer: only `signed_out` is ever read from the address; all else is ok. */
export function stepUpAnswerFromSearch(search: URLSearchParams): StepUpAnswer {
  return parseStepUpAnswer(search.get(STEP_UP_STATUS_QUERY)) ?? "ok";
}

/** Where the window goes when there is nobody to confirm: no sign-in starts, the page is told so. */
export const STEP_UP_SIGNED_OUT_PATH = `${STEP_UP_COMPLETE_PATH}?${STEP_UP_STATUS_QUERY}=signed_out`;

export const STEP_UP_COMPLETE_SCRIPT_PATH = `${STEP_UP_COMPLETE_PATH}/script`;

/** Never cached or stored: it only means something straight after the sign-in it ends. */
export const STEP_UP_COMPLETE_HEADERS = { "Cache-Control": "no-store" } as const;

function scriptPath(answer: StepUpAnswer): string {
  return answer === "ok"
    ? STEP_UP_COMPLETE_SCRIPT_PATH
    : `${STEP_UP_COMPLETE_SCRIPT_PATH}?${STEP_UP_STATUS_QUERY}=${answer}`;
}

/**
 * Runs in the window once the issuer has confirmed the person (or once Account found nobody to
 * confirm). It tells the Account page that opened it, addressed to Account's own origin exactly,
 * then closes. Without an opener (the window lost it, or someone opened the address directly) it
 * does nothing and the page's link leads back to Account. Served as a file, so no inline script
 * is needed.
 */
export function stepUpCompleteScript(answer: StepUpAnswer = "ok"): string {
  return `(function () {
  var origin = window.location.origin;
  var opener = window.opener;
  if (!opener || opener.closed) return;
  try {
    opener.postMessage({ type: ${JSON.stringify(STEP_UP_MESSAGE_TYPE)}, status: ${JSON.stringify(answer)} }, origin);
  } catch (e) {
    return;
  }
  window.close();
})();
`;
}

/**
 * Neutral on purpose: the page can be opened directly, without any sign-in, so it never says the
 * person is confirmed. The Account page behind the window says what happened.
 */
const PAGE_COPY: Record<StepUpAnswer, { title: string; lead: string }> = {
  ok: { title: "You can close this window", lead: "Carry on in LAX Account." },
  signed_out: {
    title: "You can close this window",
    lead: "You're signed out of LAX Account. Go back to it to sign in again.",
  },
};

export function stepUpCompleteHtml(answer: StepUpAnswer = "ok"): string {
  const copy = PAGE_COPY[answer];
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>LAX Account</title>
<script src="${scriptPath(answer)}" defer></script>
</head>
<body>
<main>
<h1>${copy.title}</h1>
<p>${copy.lead}</p>
<p><a href="/account">Back to LAX Account</a></p>
</main>
</body>
</html>
`;
}
