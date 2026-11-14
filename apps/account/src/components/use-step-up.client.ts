"use client";

import {
  STEP_UP_IDLE,
  type StepUpController,
  type StepUpState,
  browserStepUpEnvironment,
  createStepUpController,
} from "@/lib/step-up";
import type { AccountStepUpReason } from "@auction/identity-contracts/account";
import { useEffect, useRef, useState } from "react";

/**
 * The shared "Confirm it's you" step for any Account action that can answer `reauth_required`.
 * The action's own dialog reads `state` to switch to "Confirm it's you"; `continue` must be
 * called straight from the click so the browser lets the window open. `onConfirmed` runs the
 * action again once the person has confirmed in the window. A confirmed sign-in counts for the
 * rest of the server's window, so nothing here asks again on its own.
 */
export function useStepUp(options: {
  reason: AccountStepUpReason;
  returnTo: string;
  onConfirmed: () => void;
}) {
  const [state, setState] = useState<StepUpState>(STEP_UP_IDLE);
  const controller = useRef<StepUpController | null>(null);
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const created = createStepUpController({
      env: browserStepUpEnvironment(),
      onChange: setState,
      onConfirmed: () => latest.current.onConfirmed(),
    });
    controller.current = created;
    return () => created.dispose();
  }, []);

  return {
    state,
    require: () => controller.current?.require(),
    /** `resume` names the pending action for the full-page fallback, such as `signout:<id>`. */
    continue: (resume: string) =>
      controller.current?.continue({
        reason: latest.current.reason,
        returnTo: latest.current.returnTo,
        resume,
      }),
    cancel: () => controller.current?.cancel(),
  };
}
