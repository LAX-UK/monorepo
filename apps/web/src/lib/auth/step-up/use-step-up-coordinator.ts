"use client";

import { useCallback, useRef, useState } from "react";
import type { StepUpRequirement } from "./types";

const REAUTH_LOOP_GUARD_KEY = "lax:hosted-reauth-attempted-at";
const REAUTH_LOOP_GUARD_MS = 2 * 60 * 1000;

export type StepUpCoordinatorMode = "idle" | "password" | "no_credential";

export type StepUpCoordinatorState = {
  mode: StepUpCoordinatorMode;
  busy: boolean;
  error: string | null;
};

export function buildHostedReauthHref(pathname?: string, search?: string): string {
  const next =
    pathname != null
      ? `${pathname}${search ?? ""}`
      : `${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams({ intent: "reauth", next });
  return `/api/auth/login?${params.toString()}`;
}

export function clearHostedReauthLoopGuard(): void {
  try {
    sessionStorage.removeItem(REAUTH_LOOP_GUARD_KEY);
  } catch {
    /* ignore */
  }
}

function redirectToHostedReauth(): void {
  try {
    sessionStorage.setItem(REAUTH_LOOP_GUARD_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  window.location.assign(buildHostedReauthHref());
}

function recentReauthAttempt(): boolean {
  try {
    const raw = sessionStorage.getItem(REAUTH_LOOP_GUARD_KEY);
    if (!raw) return false;
    const at = Number.parseInt(raw, 10);
    return Number.isFinite(at) && Date.now() - at < REAUTH_LOOP_GUARD_MS;
  } catch {
    return false;
  }
}

export type IStepUpCoordinator = {
  readonly state: StepUpCoordinatorState;
  request(requirement: StepUpRequirement): Promise<"satisfied" | "cancelled">;
  cancel(): void;
};

export function useStepUpCoordinator(): IStepUpCoordinator {
  const [state, setState] = useState<StepUpCoordinatorState>({
    mode: "idle",
    busy: false,
    error: null,
  });
  const resolveRef = useRef<((v: "satisfied" | "cancelled") => void) | null>(null);

  const finish = useCallback((outcome: "satisfied" | "cancelled") => {
    if (outcome === "satisfied") {
      clearHostedReauthLoopGuard();
    }
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
        if (requirement === "recent_auth_required") {
          if (recentReauthAttempt()) {
            resolveRef.current = resolve;
            setState({
              mode: "password",
              busy: false,
              error:
                "Confirm this action by signing in again with your password on the identity page.",
            });
            return;
          }
          redirectToHostedReauth();
          return;
        }
        resolveRef.current = resolve;
        setState({
          mode: requirement === "credential_required" ? "no_credential" : "idle",
          busy: false,
          error: null,
        });
      }),
    [],
  );

  return {
    state,
    request,
    cancel,
  };
}
