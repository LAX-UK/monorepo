import { PASSKEY_COPY } from "../passkey-copy.js";
import { type PasskeyRuntime, signInWithPasskey } from "./passkey-ceremony.js";
import type { PasskeyFailure } from "./passkey-outcome.js";

/** How a failed sign-in is said: a quiet line next to the button, or the summary at the top. */
type FailureLine = { message: string; where: "quiet" | "summary" };

const unavailable: FailureLine = { message: PASSKEY_COPY.signIn.unavailable, where: "summary" };

/** Every failure has a line; the ones that cannot happen while signing in read as "try again". */
export const SIGN_IN_FAILURE_LINES: Readonly<Record<PasskeyFailure, FailureLine>> = {
  cancelled: { message: PASSKEY_COPY.signIn.cancelled, where: "quiet" },
  not_recognised: { message: PASSKEY_COPY.signIn.notRecognised, where: "summary" },
  not_verified: { message: PASSKEY_COPY.signIn.notVerified, where: "summary" },
  wrong_person: { message: PASSKEY_COPY.signIn.wrongPerson, where: "summary" },
  rate_limited: { message: PASSKEY_COPY.signIn.rateLimited, where: "summary" },
  unavailable,
  already_on_device: unavailable,
  limit: unavailable,
  expired: unavailable,
  unsupported: unavailable,
};

/** The failures of the quiet request that follow a passkey the person chose. */
const QUIET_REQUEST_REPORTS: ReadonlySet<PasskeyFailure> = new Set([
  "not_recognised",
  "not_verified",
  "wrong_person",
  "rate_limited",
]);

/** What the sign-in controller changes on the page; the DOM glue implements it. */
export type PasskeySignInView = {
  /** Shows the passkey button (it stays hidden where the browser has no passkeys). */
  reveal(): void;
  busy(busy: boolean): void;
  quietNote(message: string | null): void;
  summary(message: string): void;
  clearStatus(): void;
  /** Leaves the page with the issuer's answer: the pending sign-in carries on. */
  proceed(data: unknown): void;
  focusButton(): void;
};

/**
 * Passkey sign-in on a hosted page. Two entrances share one ceremony: the button, and the quiet
 * request that lets the browser offer saved passkeys when the email box is tapped. The quiet one
 * says nothing when it is dismissed or cannot run, because the person never asked for it.
 */
export function createPasskeySignIn(input: {
  runtime: PasskeyRuntime;
  view: PasskeySignInView;
  /** The page has an email box marked for passkey autofill. */
  hasAutofillField: boolean;
}) {
  const { runtime, view } = input;

  function show(failure: PasskeyFailure): void {
    const line = SIGN_IN_FAILURE_LINES[failure];
    if (line.where === "quiet") view.quietNote(line.message);
    else view.summary(line.message);
  }

  async function startAutofill(): Promise<void> {
    if (!input.hasAutofillField || !(await runtime.supportsAutofill())) return;
    const result = await signInWithPasskey(runtime, { autofill: true });
    if (result.ok) {
      view.proceed(result.data);
      return;
    }
    // Only what the person did (chose a passkey that was refused) is worth a line. A prompt that
    // was dismissed, replaced by the button, or that this browser cannot run quietly is not.
    if (QUIET_REQUEST_REPORTS.has(result.failure)) show(result.failure);
  }

  return {
    /** Reveals the button where passkeys work, and starts the quiet request. */
    async start(): Promise<void> {
      if (!runtime.supportsPasskeys()) return;
      view.reveal();
      await startAutofill();
    },

    /** The button: opens the device prompt. */
    async signIn(): Promise<void> {
      view.clearStatus();
      view.quietNote(null);
      view.busy(true);
      const result = await signInWithPasskey(runtime);
      view.busy(false);
      if (result.ok) {
        view.proceed(result.data);
        return;
      }
      show(result.failure);
      view.focusButton();
      // The button's request replaced the quiet one; start it again for the next try.
      await startAutofill();
    },
  };
}
