"use client";

import {
  STEP_UP_IDLE,
  type StepUpController,
  type StepUpState,
  browserStepUpEnvironment,
  createStepUpController,
} from "@/lib/step-up";
import type { AccountStepUpReason } from "@auction/identity-contracts/account";
import { useEffect, useMemo, useRef, useState } from "react";

/** The action waiting on "Confirm it's you". */
export type StepUpPending = {
  reason: AccountStepUpReason;
  /** Runs the action again once the person has confirmed in the window. */
  retry: () => void;
  /** Names the action for the full-page fallback to reopen (`signout:<id>`), when it can be. */
  resume?: string;
  /** The person pressed Cancel: nothing was changed. */
  onCancel?: () => void;
};

export type StepUp = {
  state: StepUpState;
  /** Why the step is asked, for the dialog's words; null while idle. */
  reason: AccountStepUpReason | null;
} & StepUpActions;

/** Stable across renders, so they can be used in memoised callbacks. */
type StepUpActions = {
  /** The action answered `reauth_required`: show "Confirm it's you". */
  require: (pending: StepUpPending) => void;
  /** Continue, called straight from the click so the browser lets the window open. */
  continue: () => void;
  cancel: () => void;
};

/**
 * The shared "Confirm it's you" step for every Account action that can answer `reauth_required`;
 * {@link StepUpDialog} shows it. `retry` runs the action again once the person has confirmed in
 * the window. A confirmed sign-in counts for the rest of the server's window, so nothing here
 * asks again on its own. `returnTo` is where the full-page fallback comes back to.
 */
export function useStepUp(options: { returnTo: string }): StepUp {
  const [state, setState] = useState<StepUpState>(STEP_UP_IDLE);
  const [pending, setPending] = useState<StepUpPending | null>(null);
  const controller = useRef<StepUpController | null>(null);
  const latest = useRef({ ...options, pending });
  latest.current = { ...options, pending };

  useEffect(() => {
    const created = createStepUpController({
      env: browserStepUpEnvironment(),
      onChange: setState,
      onConfirmed: () => latest.current.pending?.retry(),
    });
    controller.current = created;
    return () => created.dispose();
  }, []);

  const actions = useMemo<StepUpActions>(
    () => ({
      require: (next) => {
        latest.current.pending = next;
        setPending(next);
        controller.current?.require();
      },
      continue: () => {
        const current = latest.current.pending;
        if (!current) return;
        controller.current?.continue({
          reason: current.reason,
          returnTo: latest.current.returnTo,
          ...(current.resume ? { resume: current.resume } : {}),
        });
      },
      cancel: () => {
        const current = latest.current.pending;
        latest.current.pending = null;
        setPending(null);
        controller.current?.cancel();
        current?.onCancel?.();
      },
    }),
    [],
  );

  return {
    state,
    reason: state.phase === "idle" ? null : (pending?.reason ?? null),
    ...actions,
  };
}
