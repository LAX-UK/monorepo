"use client";

import { updateDealTermsAction } from "@/lib/actions/admin/admin-private-sales";
import {
  type TermsDraft,
  changedTerms,
  initialTermsDraft,
  validateTerms,
} from "@/lib/admin/private-sales/private-sale-forms";
import { TERM_LABELS } from "@/lib/admin/private-sales/private-sales.vm";
import type { DealRecord, TermKey } from "@/lib/data/http/admin-private-sales.schema";
import {
  ChoiceRow,
  DateTimeInput,
  EnumSelect,
  Field,
  FormErrorSummary,
  MoneyInput,
  Notice,
  PercentInput,
  StaffButton,
  StaffCheckbox,
  StaffDialog,
} from "@auction/staff-ui";
import { useEffect, useId, useRef, useState } from "react";
import { type DealWriteFailure, FailureNotice, dealFailureOf } from "./deal-action-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: DealRecord;
  onReload: () => void;
  onDone: (deal: DealRecord) => void;
  update?: typeof updateDealTermsAction;
};

const NOT_CHOSEN = "__none";

/**
 * The terms of a deal that this person may still change. A field appears only while it is open at
 * this stage and for this role, so there is never a field that would be refused. VAT is chosen
 * from the approved list only; while that list is not set up, the field says so rather than
 * accepting a value.
 */
export function DealTermsDialog({
  open,
  onOpenChange,
  deal,
  onReload,
  onDone,
  update = updateDealTermsAction,
}: Props) {
  const ids = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const editable = deal.editableTerms;
  const [draft, setDraft] = useState<TermsDraft>(() => initialTermsDraft(deal));
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<DealWriteFailure | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initialTermsDraft(deal));
    setAttempted(false);
    setFailure(null);
  }, [open, deal]);

  const has = (key: TermKey) => editable.includes(key);
  const fieldId = (key: TermKey) => `${ids}-${key}`;
  const errors = attempted ? validateTerms(draft, editable) : {};
  const summary = (Object.keys(errors) as TermKey[]).flatMap((key) =>
    errors[key] ? [{ fieldId: fieldId(key), message: errors[key] as string }] : [],
  );
  const changes = changedTerms(deal, draft, editable);
  const nothingToSave = Object.keys(changes).length === 0;

  async function save() {
    setAttempted(true);
    if (Object.keys(validateTerms(draft, editable)).length > 0) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    if (nothingToSave) {
      onOpenChange(false);
      return;
    }
    setFailure(null);
    setBusy(true);
    const result = await update(deal.reference, { version: deal.version, terms: changes });
    setBusy(false);
    if (result.ok && result.data) {
      onOpenChange(false);
      onDone(result.data);
    } else if (!result.ok) {
      setFailure(dealFailureOf(result));
    }
  }

  const vatOptions = [
    { value: NOT_CHOSEN, label: "Not chosen yet" },
    ...deal.policy.vatTreatments.map((t) => ({ value: t.code, label: t.label })),
  ];
  const vatNotConfigured = deal.policy.gaps.includes("vat_treatments");

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      size="md"
      initialFocusRef={cancelRef}
      title={`Terms · ${deal.reference}`}
      description="Only the terms that can still change at this stage are shown. Each change is recorded."
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={`${ids}-form`} variant="primary" loading={busy}>
            Save terms
          </StaffButton>
        </>
      }
    >
      <form
        id={`${ids}-form`}
        noValidate
        aria-label={`Terms for ${deal.reference}`}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <FormErrorSummary errors={summary} focusKey={failedSubmits} />
        {failure ? (
          <FailureNotice
            failure={failure}
            title="The terms couldn't be saved"
            onReload={onReload}
          />
        ) : null}
        {has("priceMinor") ? (
          <Field
            label={TERM_LABELS.priceMinor}
            id={fieldId("priceMinor")}
            description="Leave empty while the price is still being discussed."
            error={errors.priceMinor}
            optional
            disabled={busy}
          >
            <MoneyInput
              value={draft.priceMinor}
              onValueChange={(priceMinor) => setDraft((d) => ({ ...d, priceMinor }))}
            />
          </Field>
        ) : null}
        {has("buyerFeeBps") ? (
          <Field
            label={TERM_LABELS.buyerFeeBps}
            id={fieldId("buyerFeeBps")}
            description="Charged to the buyer on top of the price. None unless you set one."
            error={errors.buyerFeeBps}
            disabled={busy}
          >
            <PercentInput
              value={draft.buyerFeeRate ?? ""}
              onValueChange={(buyerFeeRate) => setDraft((d) => ({ ...d, buyerFeeRate }))}
            />
          </Field>
        ) : null}
        {has("sellerCommissionBps") ? (
          <Field
            label={TERM_LABELS.sellerCommissionBps}
            id={fieldId("sellerCommissionBps")}
            description="Taken from the price when the seller is paid. The invoice waits for it."
            error={errors.sellerCommissionBps}
            optional
            disabled={busy}
          >
            <PercentInput
              value={draft.sellerCommissionRate ?? ""}
              onValueChange={(sellerCommissionRate) =>
                setDraft((d) => ({ ...d, sellerCommissionRate }))
              }
            />
          </Field>
        ) : null}
        {has("costsMinor") ? (
          <Field
            label={TERM_LABELS.costsMinor}
            id={fieldId("costsMinor")}
            description="Costs taken from the seller's proceeds. £0.00 for none."
            error={errors.costsMinor}
            disabled={busy}
          >
            <MoneyInput
              value={draft.costsMinor}
              onValueChange={(costsMinor) => setDraft((d) => ({ ...d, costsMinor }))}
            />
          </Field>
        ) : null}
        {has("vatTreatment") ? (
          vatNotConfigured ? (
            <Notice tone="warning" title="VAT treatments not configured">
              {TERM_LABELS.vatTreatment} can't be chosen until the accountant's list is set up. The
              invoice stays blocked until then.
            </Notice>
          ) : (
            <Field
              label={TERM_LABELS.vatTreatment}
              id={fieldId("vatTreatment")}
              description="From the accountant's approved list. The invoice waits for it."
              optional
              disabled={busy}
            >
              <EnumSelect
                value={draft.vatTreatment ?? NOT_CHOSEN}
                options={vatOptions}
                onValueChange={(value) =>
                  setDraft((d) => ({ ...d, vatTreatment: value === NOT_CHOSEN ? null : value }))
                }
              />
            </Field>
          )
        ) : null}
        {has("offerExpiresAt") ? (
          <Field
            label={TERM_LABELS.offerExpiresAt}
            id={fieldId("offerExpiresAt")}
            description="After this the offer lapses. Leave empty for no expiry."
            optional
            disabled={busy}
          >
            <DateTimeInput
              value={draft.offerExpiresAt}
              onValueChange={(offerExpiresAt) => setDraft((d) => ({ ...d, offerExpiresAt }))}
            />
          </Field>
        ) : null}
        {has("partiesDisclosed") ? (
          <ChoiceRow
            htmlFor={fieldId("partiesDisclosed")}
            label="The buyer and seller may know who the other is"
            description="Off by default. Each side sees the other as LAX."
            disabled={busy}
            control={
              <StaffCheckbox
                id={fieldId("partiesDisclosed")}
                checked={draft.partiesDisclosed}
                disabled={busy}
                onCheckedChange={(checked) =>
                  setDraft((d) => ({ ...d, partiesDisclosed: checked === true }))
                }
              />
            }
          />
        ) : null}
        {editable.length === 0 ? (
          <p className="m-0 text-staff-sm text-staff-muted">
            No terms can be changed at this stage, or with your role.
          </p>
        ) : null}
      </form>
    </StaffDialog>
  );
}
