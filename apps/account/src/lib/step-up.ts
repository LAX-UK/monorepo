import { buildReauthHref } from "@/server/domain/account-reauth";
import type { AccountStepUpReason } from "@auction/identity-contracts/account";
import { STEP_UP_MESSAGE_TYPE, type StepUpAnswer, parseStepUpAnswer } from "./step-up-complete";

/**
 * "Confirm it's you" without leaving the page. When an action answers `reauth_required`, its own
 * dialog asks the person to confirm; Continue opens the issuer's confirm flow in a small window,
 * which reports back here once the person has signed in again, and the action runs again. If the
 * browser blocks the window, or nobody is signed in to Account any more, the page falls back to a
 * full-page sign-in; an action that can be named comes back in `resume`, so the same dialog opens
 * again for one more click.
 */

/** idle: nothing asked. confirm: the dialog says "Confirm it's you". waiting: the window is open. */
export type StepUpPhase = "idle" | "confirm" | "waiting";
export type StepUpState = {
  phase: StepUpPhase;
  /** The window closed, or a confirmation did not count: a quiet "Not confirmed yet". */
  notConfirmed: boolean;
};

export const STEP_UP_IDLE: StepUpState = { phase: "idle", notConfirmed: false };

/** A named window, so a second Continue reuses it rather than opening another. */
export const STEP_UP_WINDOW_NAME = "lax-confirm-its-you";
const WINDOW_WIDTH = 480;
const WINDOW_HEIGHT = 640;
const CLOSED_POLL_MS = 500;

export const RESUME_QUERY = "resume";

/**
 * Said in the action's own dialog, so it must hold for the window and for the full-page fallback
 * alike: it never promises the person stays on the page.
 */
export const STEP_UP_COPY = {
  title: "Confirm it's you",
  continueLabel: "Continue",
  notConfirmed: "Not confirmed yet.",
  waiting: "Finish confirming in the window that opened.",
  why: {
    add_sign_in_method: "For your security, sign in again before you add a way to sign in.",
    remove_sign_in_method: "For your security, sign in again before you remove a way to sign in.",
    rename_passkey: "For your security, sign in again before you rename a passkey.",
    change_password: "For your security, sign in again before you change your password.",
    create_backup_codes: "For your security, sign in again before you create new backup codes.",
    sign_out_devices: "For your security, sign in again before you sign out another device.",
    sign_out_other_devices:
      "For your security, sign in again before you sign out your other devices.",
    change_name: "For your security, sign in again before you change your name.",
    change_email: "For your security, sign in again before you change your email address.",
    change_phone: "For your security, sign in again before you change your phone number.",
    change_time_zone: "For your security, sign in again before you change your time zone.",
    change_addresses: "For your security, sign in again before you change your addresses.",
    change_alerts: "For your security, sign in again before you change your alerts.",
    request_data_copy: "For your security, sign in again before you ask for a copy of your data.",
    download_data_copy: "For your security, sign in again before you download a copy of your data.",
    delete_data_copy: "For your security, sign in again before you delete a copy of your data.",
    request_sale: "For your security, sign in again before you send a sale request.",
    withdraw_sale_request: "For your security, sign in again before you withdraw a sale request.",
    delete_account: "For your security, sign in again before you delete your account.",
  } satisfies Record<AccountStepUpReason, string>,
} as const;

type ScreenBox = { screenX: number; screenY: number; outerWidth: number; outerHeight: number };

/** A small window centred on the current one. */
export function stepUpWindowFeatures(box: ScreenBox): string {
  const left = Math.max(0, Math.round(box.screenX + (box.outerWidth - WINDOW_WIDTH) / 2));
  const top = Math.max(0, Math.round(box.screenY + (box.outerHeight - WINDOW_HEIGHT) / 2));
  return `popup=yes,width=${WINDOW_WIDTH},height=${WINDOW_HEIGHT},left=${left},top=${top}`;
}

/**
 * What the window this page opened said, on this page's own origin, in exactly the expected shape:
 * `ok` once the person has signed in again, `signed_out` when nobody is signed in to Account any
 * more, so there was nobody for the window to confirm. Anything else (another frame, another site,
 * another shape) is null and ignored.
 */
export function readStepUpAnswer(
  event: { origin: string; source: unknown; data: unknown },
  expected: { origin: string; source: unknown },
): StepUpAnswer | null {
  if (expected.source == null || event.source !== expected.source) return null;
  if (event.origin !== expected.origin) return null;
  const data = event.data;
  if (!data || typeof data !== "object") return null;
  const message = data as { type?: unknown; status?: unknown };
  if (message.type !== STEP_UP_MESSAGE_TYPE) return null;
  return parseStepUpAnswer(message.status);
}

const PLACEHOLDER_ORIGIN = "https://account.invalid";

/** `path` with `resume` set, for the full-page fallback to come back to. */
export function withResume(path: string, resume: string): string {
  const url = new URL(path, PLACEHOLDER_ORIGIN);
  url.searchParams.set(RESUME_QUERY, resume);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `path` without `resume`, so Back and refresh are ordinary once the dialog has reopened. */
export function withoutResume(path: string): string {
  const url = new URL(path, PLACEHOLDER_ORIGIN);
  url.searchParams.delete(RESUME_QUERY);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** What a step-up window needs from the browser; a fake in tests. */
export type StepUpWindow = { closed: boolean; close(): void; focus?(): void };
export type StepUpEnvironment = {
  origin: string;
  open(url: string, name: string, features: string): StepUpWindow | null;
  assign(url: string): void;
  features(): string;
  onMessage(
    listener: (event: { origin: string; source: unknown; data: unknown }) => void,
  ): () => void;
  every(ms: number, tick: () => void): () => void;
};

/** What Continue needs to sign in again: why, where the full-page sign-in comes back to, and
 * (optionally) the pending action for that page to reopen, named in `resume`. */
export type StepUpRequest = { reason: AccountStepUpReason; returnTo: string; resume?: string };

export type StepUpController = {
  /** The action answered `reauth_required`: show "Confirm it's you". */
  require(): void;
  /**
   * Continue: open the window from the click, or fall back to the full-page sign-in. While the
   * window is still open it is only brought to the front, so nothing typed there is lost.
   */
  continue(request: StepUpRequest): void;
  /** Cancel: back to idle, nothing changed. */
  cancel(): void;
  dispose(): void;
};

/** The full-page sign-in, for when the window cannot open or cannot confirm anyone. */
export function stepUpFullPageHref({ reason, returnTo, resume }: StepUpRequest): string {
  return buildReauthHref(resume ? withResume(returnTo, resume) : returnTo, reason);
}

export function createStepUpController(options: {
  env: StepUpEnvironment;
  onChange(state: StepUpState): void;
  /** The person confirmed in the window: run the action again. */
  onConfirmed(): void;
}): StepUpController {
  const { env } = options;
  let state: StepUpState = STEP_UP_IDLE;
  let popup: StepUpWindow | null = null;
  let request: StepUpRequest | null = null;
  // A confirmation came back; if the action still asks, it did not count.
  let confirmedOnce = false;
  let stopWatching: (() => void) | null = null;

  const set = (next: StepUpState) => {
    state = next;
    options.onChange(next);
  };
  const stopWatch = () => {
    stopWatching?.();
    stopWatching = null;
  };

  const stopListening = env.onMessage((event) => {
    if (state.phase !== "waiting") return;
    const answer = readStepUpAnswer(event, { origin: env.origin, source: popup });
    if (!answer) return;
    stopWatch();
    const opened = popup;
    popup = null;
    if (answer === "signed_out") {
      // Nobody is signed in to Account any more, so the window could not confirm this person and
      // nothing may run again here: sign in on a full page, which reloads with that person's data.
      if (opened && !opened.closed) opened.close();
      if (request) env.assign(stepUpFullPageHref(request));
      return;
    }
    confirmedOnce = true;
    set(STEP_UP_IDLE);
    options.onConfirmed();
  });

  return {
    require() {
      stopWatch();
      set({ phase: "confirm", notConfirmed: confirmedOnce });
    },
    continue(next) {
      request = next;
      if (state.phase === "waiting" && popup && !popup.closed) {
        popup.focus?.();
        return;
      }
      const opened = env.open(
        buildReauthHref(next.returnTo, next.reason, { popup: true }),
        STEP_UP_WINDOW_NAME,
        env.features(),
      );
      if (!opened) {
        // Blocked, or no window to report back to: a full-page sign-in that names the action.
        env.assign(stepUpFullPageHref(next));
        return;
      }
      popup = opened;
      opened.focus?.();
      set({ phase: "waiting", notConfirmed: false });
      stopWatch();
      stopWatching = env.every(CLOSED_POLL_MS, () => {
        if (!popup?.closed) return;
        stopWatch();
        popup = null;
        if (state.phase === "waiting") set({ phase: "confirm", notConfirmed: true });
      });
    },
    cancel() {
      stopWatch();
      if (popup && !popup.closed) popup.close();
      popup = null;
      request = null;
      confirmedOnce = false;
      set(STEP_UP_IDLE);
    },
    dispose() {
      stopWatch();
      stopListening();
    },
  };
}

/** The real browser, for the hook. */
export function browserStepUpEnvironment(): StepUpEnvironment {
  return {
    origin: window.location.origin,
    open: (url, name, features) => window.open(url, name, features),
    assign: (url) => window.location.assign(url),
    features: () => stepUpWindowFeatures(window),
    onMessage(listener) {
      window.addEventListener("message", listener);
      return () => window.removeEventListener("message", listener);
    },
    every(ms, tick) {
      const id = window.setInterval(tick, ms);
      return () => window.clearInterval(id);
    },
  };
}
