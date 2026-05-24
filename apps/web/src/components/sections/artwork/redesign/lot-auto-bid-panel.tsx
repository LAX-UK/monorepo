"use client";

import { BidErrorView } from "@/components/bid/bid-error-view";
import { UnderlineInput } from "@/components/ui/input";
import { useLotPorts } from "@/lib/context/lot-ports";
import type { AutoBidSettings } from "@/lib/data/contracts";
import { formatMoney } from "@/lib/format-currency";
import { clientBidError, mapBidError } from "@/lib/ui/bid-error";
import type { Lot, LotAuctionType } from "@auction/types";
import { BodyText } from "@auction/ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { listAllowedAutoBidSteps } from "@auction/validators";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  lot: Lot;
  auctionType: LotAuctionType;
  currentPrice: string;
  minNextBid: number;
  isWinning: boolean;
  disabled: boolean;
  loginNextPath: string;
  initialSettings: AutoBidSettings | null;
  approvedBidLimit?: number | null;
  /** Sync max/step into manual bid form when user edits locally. */
  onDraftChange?: (draft: { maxAuto: string; step: string; dirty: boolean }) => void;
  onSettingsSaved?: (settings: AutoBidSettings | null) => void;
};

const ELIGIBLE: LotAuctionType[] = ["english", "buy_it_now"];

export function LotAutoBidPanel({
  lot,
  auctionType,
  currentPrice,
  minNextBid,
  isWinning,
  disabled,
  loginNextPath,
  initialSettings,
  approvedBidLimit = null,
  onDraftChange,
  onSettingsSaved,
}: Props) {
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
  const [error, setError] = useState<ReturnType<typeof clientBidError> | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const saveIdempotencyKeyRef = useRef<string | null>(null);

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

  const onMaxChange = useCallback(
    (value: string) => {
      setUserEdited(true);
      setMaxAuto(value);
      emitDraft(value, step, true);
    },
    [emitDraft, step],
  );

  const onStepSelect = useCallback(
    (value: string) => {
      setUserEdited(true);
      setStep(value);
      emitDraft(maxAuto, value, true);
    },
    [emitDraft, maxAuto],
  );

  const maxNumeric = Number.parseFloat(maxAuto);
  const stepNumeric = Number.parseFloat(step);
  const currentNumeric = Number.parseFloat(currentPrice);
  const headroom =
    Number.isFinite(maxNumeric) && Number.isFinite(currentNumeric)
      ? Math.max(0, maxNumeric - currentNumeric)
      : null;

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
    setError(null);
    setSuccess(null);
    const msg = validate();
    if (msg) {
      setError(clientBidError(msg));
      return;
    }
    setSaving(true);
    if (!saveIdempotencyKeyRef.current) {
      saveIdempotencyKeyRef.current = crypto.randomUUID();
    }
    const result = await autoBidWriter.setAutoBid({
      lotId: lot.id,
      maxAutoBidAmount: maxNumeric,
      autoBidStepAmount: stepNumeric,
      idempotencyKey: saveIdempotencyKeyRef.current,
    });
    setSaving(false);
    if (!result.ok) {
      setError(
        mapBidError(result.error, {
          verifyReturnPath: loginNextPath,
          code: result.code ?? null,
        }),
      );
      return;
    }
    saveIdempotencyKeyRef.current = null;
    setActiveSettings(result.settings);
    setMaxAuto(result.settings.maxAutoBidAmount);
    if (result.settings.autoBidStepAmount) setStep(result.settings.autoBidStepAmount);
    setUserEdited(false);
    emitDraft(result.settings.maxAutoBidAmount, result.settings.autoBidStepAmount ?? step, false);
    setSuccess("Auto-bid saved.");
    onSettingsSaved?.(result.settings);
  }, [
    autoBidWriter,
    emitDraft,
    loginNextPath,
    lot.id,
    maxNumeric,
    onSettingsSaved,
    step,
    stepNumeric,
    validate,
  ]);

  const onClear = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setClearing(true);
    const result = await autoBidWriter.clearAutoBid(lot.id);
    setClearing(false);
    if (!result.ok) {
      setError(clientBidError(result.error));
      return;
    }
    setActiveSettings(null);
    setMaxAuto("");
    setStep(defaultStep.toFixed(2));
    setUserEdited(false);
    emitDraft("", defaultStep.toFixed(2), false);
    setSuccess("Auto-bid cleared.");
    onSettingsSaved?.(null);
  }, [autoBidWriter, defaultStep, emitDraft, lot.id, onSettingsSaved]);

  if (!ELIGIBLE.includes(auctionType)) return null;

  if (lot.autoBidEnabled === false) {
    return (
      <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low/80 p-4">
        <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
          Auto-bid unavailable
        </p>
        <BodyText className="mt-2 text-sm text-on-surface-variant">
          The saleroom has disabled auto-bid on this lot. Place bids manually below.
        </BodyText>
      </div>
    );
  }

  const statusLine = activeSettings?.isActive
    ? `Active — max ${formatMoney(activeSettings.maxAutoBidAmount)} · +${formatMoney(step)} per raise${
        headroom != null ? ` · ${formatMoney(headroom.toFixed(2))} headroom` : ""
      }`
    : "Auto-bid off";

  return (
    <div
      id="lot-auto-bid-card"
      className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 ring-1 ring-outline-variant/10 dark:bg-surface-container-low/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Auto-bid
          </p>
          <p className="mt-1 font-body text-sm text-on-surface">{statusLine}</p>
          {isDirty ? (
            <p className="mt-0.5 font-label text-[10px] uppercase tracking-wider text-amber-800 dark:text-amber-200">
              Unsaved changes
            </p>
          ) : null}
        </div>
      </div>

      <BodyText className="mt-3 text-sm text-on-surface-variant">
        Each time you&apos;re outbid, we raise by your chosen step until your max is reached.
      </BodyText>

      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="lot-auto-bid-max"
            className="mb-2 block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant"
          >
            Max amount
          </label>
          <div className="flex items-center gap-2 border-b border-outline-variant/40 py-2">
            <span className="font-headline text-lg text-on-surface">£</span>
            <UnderlineInput
              id="lot-auto-bid-max"
              inputMode="decimal"
              placeholder={minNextBid.toFixed(2)}
              value={maxAuto}
              onChange={(e) => onMaxChange(e.target.value)}
              disabled={disabled || saving || clearing}
              className="border-0 p-0 text-lg focus:shadow-none"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Raise by (each round)
          </p>
          <div className="flex flex-wrap gap-2">
            {allowedSteps.map((s) => {
              const selected = Math.abs(s - stepNumeric) < 1e-9;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={disabled || saving || clearing}
                  onClick={() => onStepSelect(s.toFixed(2))}
                  className={cn(
                    "rounded-md border px-3 py-1.5 font-label text-xs font-semibold uppercase tracking-wider transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant/40 text-on-surface-variant hover:border-primary/40 hover:text-primary",
                  )}
                >
                  +{formatMoney(s.toFixed(2))}
                </button>
              );
            })}
          </div>
        </div>

        <p className="font-body text-sm text-on-surface-variant">
          {isWinning
            ? `You're high bidder — we'll defend up to ${formatMoney(maxAuto || "0")}.`
            : nextAutoBid != null
              ? `Next auto bid would be ${formatMoney(nextAutoBid.toFixed(2))}.`
              : null}
        </p>
      </div>

      {success ? <output className="mt-3 block text-sm text-primary">{success}</output> : null}
      <BidErrorView error={error} />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={disabled || saving || clearing}
          onClick={() => void onSave()}
          className="h-auto rounded-sm bg-cta-bg px-4 py-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on"
        >
          {saving ? "Saving…" : "Save auto-bid"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || saving || clearing || !activeSettings?.isActive}
          onClick={() => void onClear()}
          className="h-auto px-4 py-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
        >
          {clearing ? "Clearing…" : "Clear auto-bid"}
        </Button>
      </div>
    </div>
  );
}
