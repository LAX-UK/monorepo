import { UnderlineInput } from "@/components/ui/input";
import { formatMoney } from "@/lib/format-currency";
import { BodyText, cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { AutoBidRangeVisual } from "./auto-bid-range-visual";
import type { useLotAutoBidPanel } from "./use-lot-auto-bid-panel";

type PanelView = ReturnType<typeof useLotAutoBidPanel>;

export function LotAutoBidPanelContent(view: PanelView) {
  const {
    allowedSteps,
    activeSettings,
    maxAuto,
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
  } = view;

  return (
    <div
      id="lot-auto-bid-card"
      className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 ring-1 ring-outline-variant/10 dark:bg-surface-container-low/40"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Auto-bid
        </p>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider",
            isActive
              ? "bg-primary/15 text-primary ring-1 ring-primary/30"
              : "bg-surface-container-high text-on-surface-variant",
          )}
        >
          {isActive ? "On" : "Off"}
        </span>
      </div>

      <BodyText className="mt-3 text-sm text-on-surface-variant">
        Each time you&apos;re outbid, we raise by your chosen step until your max is reached.
      </BodyText>

      {isActive && activeSettings ? (
        <AutoBidRangeVisual currentPrice={currentPrice} maxAuto={activeSettings.maxAutoBidAmount} />
      ) : maxAuto.trim() !== "" && Number.isFinite(maxNumeric) ? (
        <AutoBidRangeVisual currentPrice={currentPrice} maxAuto={maxAuto} />
      ) : null}

      {isDirty ? (
        <p className="mt-2 font-label text-[10px] uppercase tracking-wider text-amber-800 dark:text-amber-200">
          You&apos;ve changed your auto-bid — press <strong>Save auto-bid</strong> to apply.
        </p>
      ) : null}

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
                <Button
                  key={s}
                  type="button"
                  variant="ghost"
                  disabled={disabled || saving || clearing}
                  onClick={() => onStepSelect(s.toFixed(2))}
                  className={cn(
                    "rounded-md border px-3 py-1.5 font-label text-xs font-semibold uppercase tracking-wider transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant/40 text-on-surface-variant hover:border-link/40 hover:text-link",
                  )}
                >
                  +{formatMoney(s.toFixed(2))}
                </Button>
              );
            })}
          </div>
          {Number.isFinite(stepNumeric) ? (
            <p className="mt-2 font-body text-sm text-on-surface">
              Raising by{" "}
              <span className="font-semibold">{formatMoney(stepNumeric.toFixed(2))}</span> each
              round.
            </p>
          ) : null}
        </div>

        <p className="font-body text-sm text-on-surface-variant">
          {isWinning
            ? `You're high bidder — we'll defend up to ${formatMoney(maxAuto || activeSettings?.maxAutoBidAmount || "0")}.`
            : nextAutoBid != null
              ? `Next auto bid would be ${formatMoney(nextAutoBid.toFixed(2))}.`
              : null}
        </p>
      </div>

      {success ? <output className="mt-3 block text-sm text-primary">{success}</output> : null}

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
          disabled={disabled || saving || clearing || !isActive}
          onClick={onClearRequest}
          className="h-auto px-4 py-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
        >
          {clearing ? "Clearing…" : "Clear auto-bid"}
        </Button>
      </div>

      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Clear auto-bid?"
        body="This removes your saved max auto-bid for this lot. You can set it again anytime."
        confirmLabel="Clear auto-bid"
        cancelLabel="Keep auto-bid"
        tone="danger"
        loading={clearing}
        onConfirm={onClearConfirm}
      />
    </div>
  );
}
