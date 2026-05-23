"use client";

import { Button } from "@auction/ui/components/button";
import { MESSAGES, createVeriffFrame } from "@veriff/incontext-sdk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { type KycUiPhase, kycVerifyButtonLabel } from "./kyc-copy";

const VERIFF_SESSION_STORAGE_KEY = "@veriff-session-url";

export type StartKycSessionFn = (
  returnUrl: string,
) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;

type Props = {
  returnUrl: string;
  onStartSession: StartKycSessionFn;
  onPhaseChange?: (phase: KycUiPhase) => void;
  onComplete?: () => void;
  buttonLabel?: string;
  variant?: "default" | "outline" | "secondary";
  disabled?: boolean;
  className?: string;
};

export function KycVerificationLauncher({
  returnUrl,
  onStartSession,
  onPhaseChange,
  onComplete,
  buttonLabel,
  variant = "default",
  disabled = false,
  className,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<KycUiPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const reopenAttempted = useRef(false);

  const setPhaseAndNotify = useCallback(
    (next: KycUiPhase) => {
      setPhase(next);
      onPhaseChange?.(next);
    },
    [onPhaseChange],
  );

  const openVeriffFrame = useCallback(
    (url: string) => {
      setPhaseAndNotify("in_flow");
      createVeriffFrame({
        url,
        lang: "en",
        onEvent: (msg) => {
          if (msg === MESSAGES.FINISHED || msg === MESSAGES.SUBMITTED) {
            sessionStorage.removeItem(VERIFF_SESSION_STORAGE_KEY);
            setPhaseAndNotify("submitted");
            onComplete?.();
            router.refresh();
          }
          if (msg === MESSAGES.CANCELED) {
            setPhaseAndNotify("idle");
          }
        },
        onReload: () => {
          sessionStorage.setItem(VERIFF_SESSION_STORAGE_KEY, url);
          window.location.reload();
        },
      });
    },
    [onComplete, router, setPhaseAndNotify],
  );

  const onStart = useCallback(async () => {
    setError(null);
    setPhaseAndNotify("starting");
    const result = await onStartSession(returnUrl);
    if (!result.ok) {
      setPhaseAndNotify("idle");
      setError(result.error);
      return;
    }

    try {
      openVeriffFrame(result.url);
    } catch {
      window.location.assign(result.url);
    }
  }, [onStartSession, openVeriffFrame, returnUrl, setPhaseAndNotify]);

  useEffect(() => {
    if (reopenAttempted.current || disabled) return;
    const storedUrl = sessionStorage.getItem(VERIFF_SESSION_STORAGE_KEY);
    if (!storedUrl) return;
    reopenAttempted.current = true;
    try {
      openVeriffFrame(storedUrl);
    } catch {
      sessionStorage.removeItem(VERIFF_SESSION_STORAGE_KEY);
    }
  }, [disabled, openVeriffFrame]);

  const busy = phase === "starting" || phase === "in_flow" || phase === "submitted";

  return (
    <div className={className}>
      {error ? (
        <p className="mb-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant={variant}
        disabled={disabled || busy}
        onClick={() => void onStart()}
      >
        {buttonLabel ?? kycVerifyButtonLabel(phase, phase === "starting")}
      </Button>
    </div>
  );
}
