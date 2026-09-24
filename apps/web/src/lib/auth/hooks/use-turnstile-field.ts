"use client";

import type { AuthErrorCode } from "@/lib/auth/auth-error-code";
import { shouldResetTurnstileAfterFailedSubmit } from "@/lib/auth/turnstile-after-submit";
import { turnstileSiteKey } from "@/lib/auth/turnstile-site-key";
import { useCallback, useRef, useState } from "react";

export type TurnstileWidgetApi = { reset: () => void };

/** Shared Turnstile token + reset wiring for auth task forms. */
export function useTurnstileField() {
  const siteKey = turnstileSiteKey();
  const needsTurnstile = Boolean(siteKey);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileLoadError, setTurnstileLoadError] = useState(false);
  const resetRef = useRef<(() => void) | null>(null);

  const onTurnstileReady = useCallback((api: TurnstileWidgetApi) => {
    resetRef.current = api.reset;
  }, []);

  const onTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token);
    setTurnstileLoadError(false);
  }, []);

  const onTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const onTurnstileError = useCallback(() => {
    setTurnstileLoadError(true);
    setTurnstileToken(null);
  }, []);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    resetRef.current?.();
  }, []);

  const resetTurnstileAfterFailedSubmit = useCallback(
    (code: AuthErrorCode | null) => {
      if (!shouldResetTurnstileAfterFailedSubmit(code)) return;
      resetTurnstile();
    },
    [resetTurnstile],
  );

  return {
    turnstileSiteKey: siteKey,
    needsTurnstile,
    turnstileToken,
    turnstileReady: !needsTurnstile || Boolean(turnstileToken),
    turnstileLoadError,
    onTurnstileReady,
    onTurnstileToken,
    onTurnstileExpire,
    onTurnstileError,
    resetTurnstile,
    resetTurnstileAfterFailedSubmit,
  };
}
