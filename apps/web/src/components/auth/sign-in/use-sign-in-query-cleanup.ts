"use client";

import { useEffect } from "react";

const QUERY_KEYS_TO_STRIP = [
  "session_expired",
  "auth",
  "social_error",
  "reason",
  "verify_pending",
  "twofa_required",
] as const;

export function useSignInQueryCleanup() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    let mutated = false;
    for (const key of QUERY_KEYS_TO_STRIP) {
      if (params.has(key)) {
        params.delete(key);
        mutated = true;
      }
    }
    if (!mutated) return;
    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, []);
}

export function readSignInFlashMessages(searchParams: URLSearchParams) {
  const socialError = searchParams.get("social_error") === "1" ? searchParams.get("reason") : null;
  return {
    verifyPending:
      searchParams.get("verify_pending") === "1"
        ? "Please check your inbox to finish verifying your email."
        : null,
    sessionExpired:
      searchParams.get("session_expired") === "1"
        ? "Your session expired or could not be restored. Please sign in again."
        : null,
    twofaRequired:
      searchParams.get("twofa_required") === "1"
        ? "Your account uses two-factor authentication. Sign in with your password and authenticator app."
        : null,
    registered: searchParams.get("registered") === "1",
    reset: searchParams.get("reset") === "1",
    authRequired: searchParams.get("auth") === "required",
    socialErrorMessage: socialError,
  };
}
