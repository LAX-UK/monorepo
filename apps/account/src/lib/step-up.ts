import { buildReauthHref } from "@/server/domain/account-reauth";
import type { AccountStepUpReason } from "@auction/identity-contracts/account";
import { STEP_UP_MESSAGE_TYPE } from "./step-up-complete";

/**
 * "Confirm it's you" without leaving the page. When an action answers `reauth_required`, its own
 * dialog asks the person to confirm; Continue opens the issuer's confirm flow in a small window,
 * which reports back here once the person has signed in again, and the action runs again. If the
 * browser blocks the window, the page falls back to a full-page sign-in that comes back with the
 * pending action named in `resume`, so the same dialog opens again for one more click.
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

export const STEP_UP_COPY = {
  title: "Confirm it's you",
  continueLabel: "Continue",
  notConfirmed: "Not confirmed yet.",
  waiting: "Finish confirming in the window that opened.",
  why: {
    add_sign_in_method:
      "For your security, sign in again before you add a way to sign in. You'll stay on this page.",
    remove_sign_in_method:
      "For your security, sign in again before you remove a way to sign in. You'll stay on this page.",
    change_password:
      "For your security, sign in again before you change your password. You'll stay on this page.",
    sign_out_devices:
      "For your security, sign in again before you sign out another device. You'll stay on this page.",
  } satisfies Record<AccountStepUpReason, string>,
  signOutOthers:
    "For your security, sign in again before you sign out your other devices. You'll stay on this page.",
} as const;

type ScreenBox = { screenX: number; screenY: number; outerWidth: number; outerHeight: number };

/** A small window centred on the current one. */
export function stepUpWindowFeatures(box: ScreenBox): string {
  const left = Math.max(0, Math.round(box.screenX + (box.outerWidth - WINDOW_WIDTH) / 2));
  const top = Math.max(0, Math.round(box.screenY + (box.outerHeight - WINDOW_HEIGHT) / 2));
  return `popup=yes,width=${WINDOW_WIDTH},height=${WINDOW_HEIGHT},left=${left},top=${top}`;
}

/**
 * Only the window this page opened, on this page's own origin, saying exactly "ok" counts.
 * Anything else (another frame, another site, another shape) is ignored.
 */
export function isStepUpComplete(
  event: { origin: string; source: unknown; data: unknown },
  expected: { origin: string; source: unknown },
): boolean {
  if (expected.source == null || event.source !== expected.source) return false;
  if (event.origin !== expected.origin) return false;
  const data = event.data;
  if (!data || typeof data !== "object") return false;
  const message = data as { type?: unknown; status?: unknown };
  return message.type === STEP_UP_MESSAGE_TYPE && message.status === "ok";
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

export type StepUpController = {
  /** The action answered `reauth_required`: show "Confirm it's you". */
  require(): void;
  /** Continue: open the window from the click, or fall back to the full-page sign-in. */
  continue(request: { reason: AccountStepUpReason; returnTo: string; resume: string }): void;
  /** Cancel: back to idle, nothing changed. */
  cancel(): void;
  dispose(): void;
};

export function createStepUpController(options: {
  env: StepUpEnvironment;
  onChange(state: StepUpState): void;
  /** The person confirmed in the window: run the action again. */
  onConfirmed(): void;
}): StepUpController {
  const { env } = options;
  let state: StepUpState = STEP_UP_IDLE;
  let popup: StepUpWindow | null = null;
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
    if (!isStepUpComplete(event, { origin: env.origin, source: popup })) return;
    stopWatch();
    popup = null;
    confirmedOnce = true;
    set(STEP_UP_IDLE);
    options.onConfirmed();
  });

  return {
    require() {
      stopWatch();
      set({ phase: "confirm", notConfirmed: confirmedOnce });
    },
    continue({ reason, returnTo, resume }) {
      const opened = env.open(
        buildReauthHref(returnTo, reason, { popup: true }),
        STEP_UP_WINDOW_NAME,
        env.features(),
      );
      if (!opened) {
        // Blocked, or no window to report back to: a full-page sign-in that names the action.
        env.assign(buildReauthHref(withResume(returnTo, resume), reason));
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
