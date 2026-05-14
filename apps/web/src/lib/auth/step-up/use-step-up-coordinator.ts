"use client";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-code";
import { useCallback, useRef, useState } from "react";
import type { IStepUpAuthenticator, StepUpAuthOutcome } from "./step-up-authenticator";
import { httpStepUpAuthenticator } from "./step-up-authenticator";
import type { StepUpRequirement } from "./types";

export type StepUpCoordinatorMode = "idle" | "password" | "no_credential";

export type StepUpCoordinatorState = {
  mode: StepUpCoordinatorMode;
  busy: boolean;
  error: string | null;
};

function outcomeToErrorMessage(out: StepUpAuthOutcome): string | null {
  if (out === "invalid_password") return AUTH_ERROR_MESSAGES.invalid_credentials;
  if (out === "session_required")
    return "Your session has expired or is no longer valid. Please sign in again and retry.";
  if (out === "network_error") return AUTH_ERROR_MESSAGES.unknown;
  return null;
}

export type IStepUpCoordinator = {
  readonly state: StepUpCoordinatorState;
  request(requirement: StepUpRequirement): Promise<"satisfied" | "cancelled">;
  submitPassword(password: string): Promise<void>;
  cancel(): void;
};

export function useStepUpCoordinator(
  authenticator: IStepUpAuthenticator = httpStepUpAuthenticator,
): IStepUpCoordinator {
  const [state, setState] = useState<StepUpCoordinatorState>({
    mode: "idle",
    busy: false,
    error: null,
  });
  const resolveRef = useRef<((v: "satisfied" | "cancelled") => void) | null>(null);

  const finish = useCallback((outcome: "satisfied" | "cancelled") => {
    setState({ mode: "idle", busy: false, error: null });
    resolveRef.current?.(outcome);
    resolveRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    finish("cancelled");
  }, [finish]);

  const request = useCallback(
    (requirement: StepUpRequirement): Promise<"satisfied" | "cancelled"> =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        setState({
          mode: requirement === "credential_required" ? "no_credential" : "password",
          busy: false,
          error: null,
        });
      }),
    [],
  );

  const submitPassword = useCallback(
    async (password: string) => {
      setState((s) => ({ ...s, busy: true, error: null }));
      const out = await authenticator.verifyPassword(password);
      if (out === "ok") {
        finish("satisfied");
        return;
      }
      if (out === "no_credential") {
        setState({ mode: "no_credential", busy: false, error: null });
        return;
      }
      const msg = outcomeToErrorMessage(out);
      setState((s) => ({ ...s, busy: false, error: msg }));
    },
    [authenticator, finish],
  );

  return {
    state,
    request,
    submitPassword,
    cancel,
  };
}
