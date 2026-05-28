"use client";

import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { Button } from "@auction/ui/components/button";
import { MESSAGES, createVeriffFrame } from "@veriff/incontext-sdk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  KYC_FLOW_CANCELED_MESSAGE,
  type KycUiPhase,
  canStartKycVerification,
  effectiveKycPhase,
  kycInitialPhase,
  kycVerifyButtonLabel,
} from "./kyc-copy";

const VERIFF_SESSION_STORAGE_KEY = "@veriff-session-url";

export type StartKycSessionFn = (
  returnUrl: string,
) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;

type Props = {
  returnUrl: string;
  onStartSession: StartKycSessionFn;
  kycSummary?: KycStatusSummaryDto | null;
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
  kycSummary = null,
  onPhaseChange,
  onComplete,
  buttonLabel,
  variant = "default",
  disabled = false,
  className,
}: Props) {
  const router = useRouter();
  const [clientPhase, setClientPhase] = useState<KycUiPhase>(() => kycInitialPhase(kycSummary));
  const [error, setError] = useState<string | null>(null);
  const reopenAttempted = useRef(false);

  const phase = effectiveKycPhase(kycSummary, clientPhase);
  const canStart = canStartKycVerification(kycSummary, clientPhase);

  useEffect(() => {
    setClientPhase((prev) => {
      if (prev === "starting" || prev === "in_flow" || prev === "submitted") return prev;
      return kycInitialPhase(kycSummary);
    });
  }, [kycSummary]);

  const setPhaseAndNotify = useCallback(
    (next: KycUiPhase) => {
      setClientPhase(next);
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
            sessionStorage.removeItem(VERIFF_SESSION_STORAGE_KEY);
            setPhaseAndNotify(kycInitialPhase(kycSummary));
            setError(KYC_FLOW_CANCELED_MESSAGE);
            router.refresh();
          }
        },
        onReload: () => {
          sessionStorage.setItem(VERIFF_SESSION_STORAGE_KEY, url);
          window.location.reload();
        },
      });
    },
    [kycSummary, onComplete, router, setPhaseAndNotify],
  );

  const onStart = useCallback(async () => {
    setError(null);
    setPhaseAndNotify("starting");
    const result = await onStartSession(returnUrl);
    if (!result.ok) {
      setPhaseAndNotify(kycInitialPhase(kycSummary));
      setError(
        typeof result.error === "string"
          ? result.error
          : "Could not start verification. Please try again.",
      );
      return;
    }

    try {
      openVeriffFrame(result.url);
    } catch {
      window.location.assign(result.url);
    }
  }, [kycSummary, onStartSession, openVeriffFrame, returnUrl, setPhaseAndNotify]);

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

  const busy =
    clientPhase === "starting" || clientPhase === "in_flow" || clientPhase === "submitted";

  if (!canStart && !busy) {
    return null;
  }

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
        disabled={disabled || busy || !canStart}
        onClick={() => void onStart()}
      >
        {buttonLabel ?? kycVerifyButtonLabel(kycSummary, phase, clientPhase === "starting")}
      </Button>
    </div>
  );
}
