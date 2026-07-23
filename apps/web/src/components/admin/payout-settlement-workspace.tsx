"use client";

import { AdminLegalEntityPicker } from "@/components/admin/admin-legal-entity-picker";
import { PendingFormSubmit } from "@/components/admin/pending-form-submit";
import { runPayoutSettlementAction } from "@/lib/admin/finance/admin-finance-mutations";
import type { AdminSettlementPreview } from "@/lib/data/http/admin-payouts.shared";
import { formatMoney } from "@/lib/ui/format";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";

const FORM_ID = "payout-settlement-form";

type Props = {
  loadPreview: (legalEntityId: string) => Promise<AdminSettlementPreview>;
};

export function PayoutSettlementWorkspace({ loadPreview }: Props) {
  const [legalEntityId, setLegalEntityId] = useState<string | null>(null);
  const [legalEntityLabel, setLegalEntityLabel] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminSettlementPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loadingPreview, startPreviewTransition] = useTransition();
  const pickerId = "payout-settlement-legal-entity";

  const refreshPreview = useCallback(
    (entityId: string) => {
      startPreviewTransition(async () => {
        setPreviewError(null);
        setPreview(null);
        setConfirmed(false);
        try {
          const next = await loadPreview(entityId);
          setPreview(next);
        } catch (error) {
          setPreviewError(
            error instanceof Error ? error.message : "Could not load settlement preview.",
          );
        }
      });
    },
    [loadPreview],
  );

  const onEntityChange = (id: string | null, label: string | null) => {
    setLegalEntityId(id);
    setLegalEntityLabel(label);
    setConfirmed(false);
    setPreview(null);
    setPreviewError(null);
    if (id) refreshPreview(id);
  };

  const hasEligiblePayments = (preview?.pending.paymentCount ?? 0) > 0;
  const hasOpenPayout = preview?.openPayout != null;

  return (
    <div className="space-y-6">
      <section aria-labelledby="settlement-select-heading" className="space-y-3">
        <div>
          <h2 id="settlement-select-heading" className="font-heading text-lg">
            1. Select legal entity
          </h2>
          <p className="text-sm text-on-surface-variant">
            Choose the seller entity you want to settle immediately.
          </p>
        </div>
        <div className="block space-y-1 text-sm">
          <label htmlFor={pickerId} className="font-medium">
            Legal entity
          </label>
          <AdminLegalEntityPicker
            id={pickerId}
            value={legalEntityId}
            displayLabel={legalEntityLabel}
            onChange={(id, row) => onEntityChange(id, row?.displayName ?? null)}
            searchPlaceholder="Search legal entities…"
          />
        </div>
      </section>

      {previewError ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Preview unavailable</AlertTitle>
          <AlertDescription>{previewError}</AlertDescription>
        </Alert>
      ) : null}

      {loadingPreview ? (
        <output className="block text-sm text-on-surface-variant" aria-live="polite">
          Loading settlement preview…
        </output>
      ) : null}

      {preview && legalEntityId ? (
        <section aria-labelledby="settlement-review-heading" className="space-y-4">
          <div>
            <h2 id="settlement-review-heading" className="font-heading text-lg">
              2. Review settlement
            </h2>
            <p className="text-sm text-on-surface-variant">
              Confirm the payment scope and net amount before creating the payout.
            </p>
          </div>

          <dl className="grid gap-3 rounded-md border border-outline-variant/30 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-on-surface-variant">Eligible payments</dt>
              <dd className="text-lg font-semibold tabular-nums">{preview.pending.paymentCount}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Pending gross</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(preview.pending.pendingGross, preview.pending.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Platform fees</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(preview.pending.pendingPlatformFee, preview.pending.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Estimated net</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatMoney(preview.pending.pendingNet, preview.pending.currency)}
              </dd>
            </div>
          </dl>

          {hasOpenPayout ? (
            <Alert role="alert">
              <AlertTitle>Open payout already exists</AlertTitle>
              <AlertDescription>
                This entity already has a modifiable payout in {preview.openPayout?.status} status.
                Review{" "}
                <Link href="/admin/payouts" className="text-link underline">
                  existing payouts
                </Link>{" "}
                before running another settlement.
              </AlertDescription>
            </Alert>
          ) : null}

          {!hasEligiblePayments ? (
            <Alert>
              <AlertTitle>No eligible payments</AlertTitle>
              <AlertDescription>
                There are no captured payments waiting to settle for this entity.
              </AlertDescription>
            </Alert>
          ) : null}
        </section>
      ) : null}

      {preview && legalEntityId && hasEligiblePayments && !hasOpenPayout ? (
        <section aria-labelledby="settlement-confirm-heading" className="space-y-4">
          <div>
            <h2 id="settlement-confirm-heading" className="font-heading text-lg">
              3. Confirm settlement
            </h2>
            <p className="text-sm text-on-surface-variant">
              Settlement creates a payout immediately for{" "}
              {legalEntityLabel ?? "the selected entity"}.
            </p>
          </div>

          {!confirmed ? (
            <Button type="button" onClick={() => setConfirmed(true)}>
              Review complete — enable settlement
            </Button>
          ) : (
            <form id={FORM_ID} action={runPayoutSettlementAction} className="space-y-3">
              <input type="hidden" name="legalEntityId" value={legalEntityId} />
              <PendingFormSubmit
                formId={FORM_ID}
                pendingLabel="Running settlement…"
                className="rounded-md bg-primary px-4 py-2 font-label text-sm font-semibold text-on-primary"
              >
                Run settlement for{" "}
                {formatMoney(preview.pending.pendingNet, preview.pending.currency)}
              </PendingFormSubmit>
              <Button type="button" variant="outline" onClick={() => setConfirmed(false)}>
                Back to review
              </Button>
            </form>
          )}
        </section>
      ) : null}
    </div>
  );
}
