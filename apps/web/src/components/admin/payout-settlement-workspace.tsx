"use client";

import { RecordAgreementDialog } from "@/components/admin/seller-proceeds/record-agreement-dialog";
import {
  SettlementDealsTable,
  SettlementSalesTable,
} from "@/components/admin/seller-proceeds/settlement-sales-table";
import { runPayoutSettlementAction } from "@/lib/admin/finance/admin-finance-mutations";
import { IDEMPOTENCY_KEY_FIELD } from "@/lib/admin/finance/idempotency-key";
import { presentPayoutStatus } from "@/lib/admin/finance/payouts-staff-list.vm";
import { useIdempotencyKey } from "@/lib/admin/finance/use-idempotency-key";
import { searchLegalEntityOptions } from "@/lib/admin/pickers/staff-entity-search";
import { FINANCE_SETTINGS_HREF } from "@/lib/admin/seller-proceeds/lot-seller-proceeds.vm";
import type { RecordAgreementContext } from "@/lib/admin/seller-proceeds/record-agreement.vm";
import {
  SETTLEMENT_COPY,
  type SettlementRow,
  buildSettlementPreview,
} from "@/lib/admin/seller-proceeds/settlement-preview.vm";
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
} from "@auction/staff-ui";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";

type Props = {
  loadPreview: (legalEntityId: string) => Promise<AdminSettlementPreview>;
  /** Test override for the legal entity search. */
  searchEntities?: (query: string) => Promise<readonly EntityOption[]>;
  /** May this person record a seller's signed agreement from a held row. */
  canRecordAgreement?: boolean;
  /** Test override for the run; the server action otherwise. */
  runSettlement?: typeof runPayoutSettlementAction;
  /** For the review route: start with a seller chosen and their preview loaded. */
  initial?: {
    entity: EntityOption;
    preview: AdminSettlementPreview | null;
    confirming?: boolean;
    loading?: boolean;
    figuresChanged?: boolean;
  };
};

const statusLabel = (status: string) =>
  presentPayoutStatus(status as Parameters<typeof presentPayoutStatus>[0]).label;

/**
 * Pay one seller now instead of waiting for the nightly run: choose the legal entity, read every
 * waiting sale with what the seller receives for it, then run it. Held sales stay in the list in
 * red with their reason and do not stop the rest. Totals are the ready rows added up. Running asks
 * first, naming the seller, the amount and what stays held; the API asks for a fresh sign-in
 * when it wants one.
 */
export function PayoutSettlementWorkspace({
  loadPreview,
  searchEntities = searchLegalEntityOptions,
  canRecordAgreement = false,
  runSettlement = runPayoutSettlementAction,
  initial,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const { key: idempotencyKey, rotate: rotateIdempotencyKey } = useIdempotencyKey();
  const [figuresChanged, setFiguresChanged] = useState(initial?.figuresChanged ?? false);
  const [entity, setEntity] = useState<EntityOption | null>(initial?.entity ?? null);
  const [preview, setPreview] = useState<AdminSettlementPreview | null>(initial?.preview ?? null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(initial?.confirming ?? false);
  const [recordFor, setRecordFor] = useState<RecordAgreementContext | null>(null);
  const [loadingPreview, startPreview] = useTransition();
  const [running, startRun] = useTransition();

  const load = useCallback(
    (option: EntityOption) => {
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

  const choose = useCallback(
    (option: EntityOption | null) => {
      setEntity(option);
      setPreview(null);
      setPreviewError(null);
      if (option) load(option);
    },
    [load],
  );

  const model = useMemo(
    () => (preview && entity ? buildSettlementPreview(preview, entity.label, statusLabel) : null),
    [preview, entity],
  );
  const vatSetting = useMemo(() => {
    const ready = preview?.pending.sales.find((sale) => sale.kind === "ready");
    return ready?.kind === "ready" ? ready.commissionVatTreatment : null;
  }, [preview]);

  const recordRow = (row: SettlementRow) => {
    const sale = preview?.pending.sales.find((s) => s.paymentId === row.id);
    if (!sale?.lotId || sale.hammerPence === null) return;
    setRecordFor({
      lotId: sale.lotId,
      lot: row.lot,
      lotTitle: row.lotTitle ?? "",
      sellerName: entity?.label ?? null,
      hammerPence: sale.hammerPence,
      vatSetting,
    });
  };

  const run = model?.kind === "sales" ? model.run : null;
  const loading =
    initial?.loading || loadingPreview || (entity !== null && !preview && !previewError);

  return (
    <div className="flex flex-col gap-6">
      <Section title="Seller" description="The legal entity to pay now.">
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
          description="Every captured sale waiting to settle for this entity, with what the seller receives."
        >
          <div className="flex flex-col gap-4">
            {previewError ? (
              <Notice tone="danger" alert title="The preview could not load">
                {previewError}
              </Notice>
            ) : loading || !model ? (
              <output
                aria-busy="true"
                aria-label="Loading the preview"
                className="flex flex-col gap-3"
              >
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </output>
            ) : model.kind === "open_payout" ? (
              <Notice tone="warning" title={SETTLEMENT_COPY.openPayoutTitle}>
                It is {model.statusLabel.toLowerCase()}. Settle or cancel it from{" "}
                <TextLink href="/admin/payouts" Link={Link}>
                  Payouts
                </TextLink>{" "}
                before running another.
              </Notice>
            ) : model.kind === "nothing_to_settle" ? (
              <Notice tone="info" title="Nothing to settle">
                {SETTLEMENT_COPY.nothingToSettle}
              </Notice>
            ) : model.kind === "vat_missing" ? (
              <>
                <Notice
                  tone="danger"
                  alert
                  title={SETTLEMENT_COPY.vatMissingTitle}
                  actions={
                    <StaffButton asChild size="sm" variant="secondary">
                      <Link href={FINANCE_SETTINGS_HREF}>Open settings</Link>
                    </StaffButton>
                  }
                >
                  {SETTLEMENT_COPY.vatMissing}
                </Notice>
                <SettlementSalesTable rows={model.rows} />
              </>
            ) : (
              <>
                {model.run === null ? (
                  <Notice tone="warning" title={SETTLEMENT_COPY.allHeldTitle}>
                    Every sale waiting for this entity is held. Fix what each row names and it joins
                    the next payout.
                  </Notice>
                ) : null}
                <KeyValueList
                  columns={2}
                  items={[
                    {
                      label: model.summary.readyLabel,
                      value: model.summary.heldLabel ?? "None held",
                    },
                    { label: "Hammer", value: model.summary.hammer, numeric: true },
                    { label: "Commission", value: model.summary.commission, numeric: true },
                    { label: "VAT on commission", value: model.summary.vat, numeric: true },
                    ...(model.summary.deals
                      ? [{ label: "Private sales", value: model.summary.deals, numeric: true }]
                      : []),
                    { label: "Net to the seller", value: model.summary.net, numeric: true },
                  ]}
                />
                {model.rows.length > 0 ? (
                  <SettlementSalesTable
                    rows={model.rows}
                    {...(canRecordAgreement ? { onRecord: recordRow } : {})}
                  />
                ) : null}
                {model.dealRows.length > 0 ? <SettlementDealsTable rows={model.dealRows} /> : null}
                <p className="text-staff-xs text-staff-muted">{model.premiumLine}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <StaffButton
                    variant="primary"
                    loading={running}
                    disabled={run === null}
                    aria-describedby={
                      model.disabledReason ? "settlement-disabled-reason" : undefined
                    }
                    onClick={() => setConfirming(true)}
                  >
                    {run?.label ?? "Run settlement"}
                  </StaffButton>
                  {model.disabledReason ? (
                    <span
                      id="settlement-disabled-reason"
                      className="text-staff-sm text-staff-muted"
                    >
                      {model.disabledReason}
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </Section>
      ) : null}

      <form ref={formRef} hidden>
        <input type="hidden" name="legalEntityId" value={entity?.id ?? ""} />
        <input type="hidden" name="reason" ref={reasonRef} defaultValue="" />
        {/* What the person is confirming: the run pays exactly this or refuses. */}
        <input
          type="hidden"
          name="confirmed"
          value={run ? JSON.stringify(run.confirmed) : ""}
          readOnly
        />
        <input type="hidden" name={IDEMPOTENCY_KEY_FIELD} value={idempotencyKey} readOnly />
      </form>

      <ConfirmActionDialog
        open={confirming && run !== null}
        onOpenChange={(open) => {
          if (running) return;
          setConfirming(open);
          if (!open) setFiguresChanged(false);
        }}
        title={run?.confirmTitle ?? ""}
        description={run?.confirmBody ?? ""}
        confirmLabel={`Pay ${run?.amount ?? ""}`}
        cancelLabel="Not now"
        loading={running}
        reason={{
          label: SETTLEMENT_COPY.reasonLabel,
          description: SETTLEMENT_COPY.reasonHint,
          minLength: 10,
        }}
        onConfirm={({ reason }) =>
          startRun(async () => {
            if (reasonRef.current) reasonRef.current.value = reason;
            const form = formRef.current;
            if (!form) return;
            const outcome = await runSettlement(new FormData(form));
            if (outcome?.error === "figures_changed") {
              // Nothing was paid. Show why, fetch the figures again, and use a new key for the
              // next confirm so it is not answered from the refused one.
              setFiguresChanged(true);
              rotateIdempotencyKey();
              if (entity) load(entity);
            }
          })
        }
      >
        {figuresChanged ? (
          <Notice tone="danger" alert title={SETTLEMENT_COPY.figuresChangedTitle}>
            {SETTLEMENT_COPY.figuresChanged}
          </Notice>
        ) : null}
      </ConfirmActionDialog>

      {recordFor ? (
        <RecordAgreementDialog
          open
          onOpenChange={(open) => {
            if (!open) setRecordFor(null);
          }}
          context={recordFor}
          onRecorded={() => entity && load(entity)}
        />
      ) : null}
    </div>
  );
}
