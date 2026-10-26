"use client";

import { IdempotencyKeyField } from "@/components/admin/idempotency-key-field";
import { runPayoutSettlementAction } from "@/lib/admin/finance/admin-finance-mutations";
import { presentPayoutStatus } from "@/lib/admin/finance/payouts-staff-list.vm";
import { searchLegalEntityOptions } from "@/lib/admin/pickers/staff-entity-search";
import type { AdminSettlementPreview } from "@/lib/data/http/admin-payouts.shared";
import {
  ConfirmActionDialog,
  type EntityOption,
  EntityPicker,
  Field,
  KeyValueList,
  Notice,
  Section,
  Skeleton,
  StaffButton,
  TextLink,
  formatStaffMoney,
} from "@auction/staff-ui";
import Link from "next/link";
import { useCallback, useRef, useState, useTransition } from "react";

type Props = {
  loadPreview: (legalEntityId: string) => Promise<AdminSettlementPreview>;
  /** Test override for the legal entity search. */
  searchEntities?: (query: string) => Promise<readonly EntityOption[]>;
};

/** Pounds as the API sends them ("1250.5") in full, in the payout's currency. */
function money(pounds: string, currency: string): string {
  const value = Number.parseFloat(pounds);
  return formatStaffMoney(Math.round((Number.isFinite(value) ? value : 0) * 100), currency);
}

/**
 * Pay one seller now instead of waiting for the nightly run: choose the legal entity, read what
 * would be paid, then run it. Running asks first, naming the entity and the net amount; the API
 * asks for a fresh sign-in when it wants one. Nothing runs while the entity already has an open
 * payout or nothing is waiting.
 */
export function PayoutSettlementWorkspace({
  loadPreview,
  searchEntities = searchLegalEntityOptions,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [entity, setEntity] = useState<EntityOption | null>(null);
  const [preview, setPreview] = useState<AdminSettlementPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loadingPreview, startPreview] = useTransition();
  const [running, startRun] = useTransition();

  const choose = useCallback(
    (option: EntityOption | null) => {
      setEntity(option);
      setPreview(null);
      setPreviewError(null);
      if (!option) return;
      startPreview(async () => {
        try {
          setPreview(await loadPreview(option.id));
        } catch (error) {
          setPreviewError(
            error instanceof Error ? error.message : "The settlement preview could not load.",
          );
        }
      });
    },
    [loadPreview],
  );

  const pending = preview?.pending;
  const net = pending ? money(pending.pendingNet, pending.currency) : null;
  const canRun = Boolean(pending && pending.paymentCount > 0 && !preview?.openPayout);

  return (
    <div className="flex flex-col gap-6">
      <Section title="Legal entity" description="The seller to pay now.">
        <Field label="Legal entity" id="settlement-legal-entity">
          <EntityPicker
            id="settlement-legal-entity"
            value={entity?.id ?? null}
            selected={entity}
            onValueChange={choose}
            search={searchEntities}
            placeholder="Choose a legal entity"
            searchPlaceholder="Search by organisation or entity name"
            emptyText="No legal entity matches"
          />
        </Field>
      </Section>

      {entity ? (
        <Section
          title="What would be paid"
          description="Captured payments waiting to settle for this entity."
        >
          {previewError ? (
            <Notice tone="danger" alert title="The preview could not load">
              {previewError}
            </Notice>
          ) : loadingPreview || !pending ? (
            <div aria-busy="true" className="flex flex-col gap-3">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-5 w-48" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <KeyValueList
                columns={2}
                items={[
                  { label: "Payments", value: String(pending.paymentCount), numeric: true },
                  {
                    label: "Gross",
                    value: money(pending.pendingGross, pending.currency),
                    numeric: true,
                  },
                  {
                    label: "Platform fees",
                    value: money(pending.pendingPlatformFee, pending.currency),
                    numeric: true,
                  },
                  { label: "Net to the seller", value: net, numeric: true },
                ]}
              />
              {preview?.openPayout ? (
                <Notice tone="warning" title="This entity already has an open payout">
                  It is {presentPayoutStatus(preview.openPayout.status).label.toLowerCase()}. Settle
                  or cancel it from{" "}
                  <TextLink href="/admin/payouts" Link={Link}>
                    Payouts
                  </TextLink>{" "}
                  before running another.
                </Notice>
              ) : pending.paymentCount === 0 ? (
                <Notice tone="info" title="Nothing to settle">
                  No captured payments are waiting to settle for this entity.
                </Notice>
              ) : null}
              {canRun ? (
                <div>
                  <StaffButton
                    variant="primary"
                    loading={running}
                    onClick={() => setConfirming(true)}
                  >
                    Run settlement for {net}
                  </StaffButton>
                </div>
              ) : null}
            </div>
          )}
        </Section>
      ) : null}

      <form ref={formRef} action={runPayoutSettlementAction} hidden>
        <input type="hidden" name="legalEntityId" value={entity?.id ?? ""} />
        <IdempotencyKeyField />
      </form>

      <ConfirmActionDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!running) setConfirming(open);
        }}
        title={`Pay ${net ?? ""} to ${entity?.label ?? "this entity"} now?`}
        description="A payout is created at once from the captured payments above and sent to the seller's payout account. It cannot be undone from here."
        confirmLabel={`Pay ${net ?? ""}`}
        cancelLabel="Not now"
        loading={running}
        onConfirm={() => startRun(() => formRef.current?.requestSubmit())}
      />
    </div>
  );
}
