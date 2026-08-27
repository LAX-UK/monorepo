import { useIdempotencyKey } from "@/hooks/lot-bid/use-idempotency-key";
import { mapBidResultError } from "@/lib/bid/map-bid-result-error";
import { refreshBeforeSubmitIfNeeded } from "@/lib/bid/refresh-before-submit";
import { useLotPorts } from "@/lib/context/lot-ports";
import type { AutoBidPlacedBid, AutoBidSettings } from "@/lib/data/contracts";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { formatMoney } from "@/lib/format-currency";
import { clientBidError } from "@/lib/ui/bid-error";
import type { Lot, PublicLotView } from "@auction/types";
import { listAllowedAutoBidSteps } from "@auction/validators";
import { useCallback, useEffect, useMemo, useState } from "react";

export type LotAutoBidPanelProps = {
  lot: Lot | PublicLotView;
  currentPrice: string;
  minNextBid: number;
  isWinning: boolean;
  disabled: boolean;
  loginNextPath: string;
  initialSettings: AutoBidSettings | null;
  approvedBidLimit?: number | null;
  onDraftChange?: (draft: { maxAuto: string; step: string; dirty: boolean }) => void;
  onSettingsSaved?: (settings: AutoBidSettings | null, placedBid?: AutoBidPlacedBid) => void;
  onFeedbackError?: (error: ReturnType<typeof clientBidError> | null) => void;
  kycFeedback?: KycUserFeedbackDto | null;
  biddingLive?: boolean;
  biddingAllowed?: boolean;
  realtimeHealthy?: boolean;
  refreshBeforeSave?: () => Promise<boolean>;
};

export function useLotAutoBidPanel({
  lot,
  currentPrice,
  minNextBid,
  isWinning,
  disabled,
  loginNextPath,
  initialSettings,
  approvedBidLimit = null,
  onDraftChange,
  onSettingsSaved,
  onFeedbackError,
  kycFeedback = null,
  biddingLive = false,
  biddingAllowed = true,
  realtimeHealthy = true,
  refreshBeforeSave,
}: LotAutoBidPanelProps) {
  const { autoBidWriter } = useLotPorts();
  const allowedSteps = useMemo(
    () =>
      listAllowedAutoBidSteps({
        autoBidEnabled: lot.autoBidEnabled ?? true,
        minBidIncrement: lot.minBidIncrement,
        autoBidStepMin: lot.autoBidStepMin ?? null,
        autoBidStepMax: lot.autoBidStepMax ?? null,
        autoBidStepPresets: lot.autoBidStepPresets ?? null,
      }),
    [lot],
  );

  const defaultStep = allowedSteps[0] ?? minNextBid;

  const [activeSettings, setActiveSettings] = useState<AutoBidSettings | null>(initialSettings);
  const [maxAuto, setMaxAuto] = useState(initialSettings?.maxAutoBidAmount ?? "");
  const [step, setStep] = useState(initialSettings?.autoBidStepAmount ?? defaultStep.toFixed(2));
  const [userEdited, setUserEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const { ensure: ensureSaveIdempotencyKey, clear: clearSaveIdempotencyKey } = useIdempotencyKey();

  const reportError = useCallback(
    (presentation: ReturnType<typeof clientBidError> | null, scrollToFeedback = false) => {
      onFeedbackError?.(presentation);
      if (presentation && scrollToFeedback) {
        document.getElementById("lot-bid-entry")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    },
    [onFeedbackError],
  );

  useEffect(() => {
    setActiveSettings(initialSettings);
    setUserEdited(false);
    if (initialSettings) {
      setMaxAuto(initialSettings.maxAutoBidAmount);
      if (initialSettings.autoBidStepAmount) setStep(initialSettings.autoBidStepAmount);
    } else {
      setMaxAuto("");
      setStep(defaultStep.toFixed(2));
    }
  }, [defaultStep, initialSettings]);

  const emitDraft = useCallback(
    (nextMax: string, nextStep: string, dirty: boolean) => {
      onDraftChange?.({ maxAuto: nextMax, step: nextStep, dirty });
    },
    [onDraftChange],
  );

  const baselineStep = activeSettings?.autoBidStepAmount ?? defaultStep.toFixed(2);
  const baselineMax = activeSettings?.maxAutoBidAmount ?? "";

  const markDraft = useCallback(
    (nextMax: string, nextStep: string) => {
      const dirty = nextMax !== baselineMax || nextStep !== baselineStep;
      setUserEdited(dirty);
      emitDraft(nextMax, nextStep, dirty);
    },
    [baselineMax, baselineStep, emitDraft],
  );

  const onMaxChange = useCallback(
    (value: string) => {
      setMaxAuto(value);
      markDraft(value, step);
    },
    [markDraft, step],
  );

  const onStepSelect = useCallback(
    (value: string) => {
      if (Math.abs(Number.parseFloat(value) - Number.parseFloat(step)) < 1e-9) {
        return;
      }
      setStep(value);
      markDraft(maxAuto, value);
    },
    [markDraft, maxAuto, step],
  );

  const maxNumeric = Number.parseFloat(maxAuto);
  const stepNumeric = Number.parseFloat(step);
  const currentNumeric = Number.parseFloat(currentPrice);

  const nextAutoBid =
    Number.isFinite(currentNumeric) && Number.isFinite(stepNumeric)
      ? currentNumeric + stepNumeric
      : null;

  const isDirty = useMemo(() => {
    if (!userEdited) return false;
    if (!activeSettings) return true;
    return (
      maxAuto !== activeSettings.maxAutoBidAmount ||
      step !== (activeSettings.autoBidStepAmount ?? defaultStep.toFixed(2))
    );
  }, [activeSettings, defaultStep, maxAuto, step, userEdited]);

  const validate = useCallback((): string | null => {
    if (lot.autoBidEnabled === false) {
      return "Auto-bid is not available on this lot.";
    }
    if (!Number.isFinite(maxNumeric) || maxNumeric <= 0) {
      return "Enter a valid max amount.";
    }
    if (maxNumeric + 1e-9 < minNextBid) {
      return `Max must be at least ${formatMoney(minNextBid.toFixed(2))} (next minimum bid).`;
    }
    if (approvedBidLimit != null && maxNumeric > approvedBidLimit + 1e-9) {
      return `Your approved limit for this sale is ${formatMoney(approvedBidLimit.toFixed(2))}.`;
    }
    if (!Number.isFinite(stepNumeric) || stepNumeric <= 0) {
      return "Choose a valid bid step.";
    }
    const allowed = allowedSteps.some((s) => Math.abs(s - stepNumeric) < 1e-9);
    if (!allowed) {
      return `Choose a step of ${allowedSteps.map((s) => formatMoney(s.toFixed(2))).join(", ")}.`;
    }
    return null;
  }, [allowedSteps, approvedBidLimit, lot.autoBidEnabled, maxNumeric, minNextBid, stepNumeric]);

  const onSave = useCallback(async () => {
    reportError(null);
    setSuccess(null);
    const msg = validate();
    if (msg) {
      reportError(clientBidError(msg));
      return;
    }
    setSaving(true);
    try {
      const refreshResult = await refreshBeforeSubmitIfNeeded({
        biddingLive,
        biddingAllowed,
        realtimeHealthy,
        refresh: async () => ({
          ok: refreshBeforeSave ? await refreshBeforeSave() : true,
        }),
      });
      if (!refreshResult.ok) {
        reportError(refreshResult.error);
        return;
      }
      let result: Awaited<ReturnType<typeof autoBidWriter.setAutoBid>>;
      try {
        result = await autoBidWriter.setAutoBid({
          lotId: lot.id,
          maxAutoBidAmount: maxNumeric,
          autoBidStepAmount: stepNumeric,
          idempotencyKey: ensureSaveIdempotencyKey(),
        });
      } catch {
        reportError(
          clientBidError("Could not reach the server. Check your connection and try again."),
        );
        return;
      }
      if (!result.ok) {
        reportError(
          mapBidResultError({
            error: result.error,
            verifyReturnPath: loginNextPath,
            lotId: lot.id,
            code: result.code ?? null,
            kycFeedback,
          }),
          true,
        );
        return;
      }
      clearSaveIdempotencyKey();
      setActiveSettings(result.settings);
      setMaxAuto(result.settings.maxAutoBidAmount);
      if (result.settings.autoBidStepAmount) setStep(result.settings.autoBidStepAmount);
      setUserEdited(false);
      emitDraft(result.settings.maxAutoBidAmount, result.settings.autoBidStepAmount ?? step, false);
      setSuccess("Auto-bid saved.");
      onSettingsSaved?.(result.settings, result.placedBid);
    } finally {
      setSaving(false);
    }
  }, [
    autoBidWriter,
    biddingAllowed,
    biddingLive,
    clearSaveIdempotencyKey,
    emitDraft,
    ensureSaveIdempotencyKey,
    loginNextPath,
    lot.id,
    maxNumeric,
    onSettingsSaved,
    realtimeHealthy,
    refreshBeforeSave,
    step,
    stepNumeric,
    validate,
    reportError,
    kycFeedback,
  ]);

  const performClear = useCallback(async () => {
    reportError(null);
    setSuccess(null);
    setClearing(true);
    let result: Awaited<ReturnType<typeof autoBidWriter.clearAutoBid>>;
    try {
      result = await autoBidWriter.clearAutoBid(lot.id);
    } catch {
      reportError(
        clientBidError("Could not reach the server. Check your connection and try again."),
      );
      return;
    } finally {
      setClearing(false);
    }
    if (!result.ok) {
      reportError(
        mapBidResultError({
          error: result.error,
          verifyReturnPath: loginNextPath,
          lotId: lot.id,
          code: result.code ?? null,
          kycFeedback,
        }),
        true,
      );
      return;
    }
    setActiveSettings(null);
    setMaxAuto("");
    setStep(defaultStep.toFixed(2));
    setUserEdited(false);
    emitDraft("", defaultStep.toFixed(2), false);
    setSuccess("Auto-bid cleared.");
    onSettingsSaved?.(null);
  }, [
    autoBidWriter,
    defaultStep,
    emitDraft,
    kycFeedback,
    loginNextPath,
    lot.id,
    onSettingsSaved,
    reportError,
  ]);

  const onClearRequest = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const onClearConfirm = useCallback(async () => {
    await performClear();
    setShowClearConfirm(false);
  }, [performClear]);

  const isActive = Boolean(activeSettings?.isActive && activeSettings.maxAutoBidAmount);

  return {
    allowedSteps,
    activeSettings,
    maxAuto,
    step,
    stepNumeric,
    maxNumeric,
    minNextBid,
    currentPrice,
    nextAutoBid,
    isWinning,
    disabled,
    saving,
    clearing,
    showClearConfirm,
    setShowClearConfirm,
    success,
    isDirty,
    isActive,
    onMaxChange,
    onStepSelect,
    onSave,
    onClearRequest,
    onClearConfirm,
  };
}
