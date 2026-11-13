"use client";

import { uploadObjectFile } from "@/hooks/use-upload-object-lifecycle";
import {
  type RecordAgreementInput,
  recordSignedAgreementAction,
} from "@/lib/admin/seller-proceeds/record-agreement.actions";
import {
  RECORD_AGREEMENT_COPY as COPY,
  type RecordAgreementContext,
  type RecordAgreementDraft,
  type RecordedSale,
  checkRecordAgreement,
  previewRecordedAgreement,
  recordedToast,
} from "@/lib/admin/seller-proceeds/record-agreement.vm";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import type { ActionResult } from "@/lib/forms/form-result";
import { LONDON_TIME_ZONE, dayKey } from "@auction/datetime";
import {
  DateInput,
  Field,
  FileDropzone,
  FormErrorSummary,
  Notice,
  SettlementBreakdown,
  StaffButton,
  StaffDialog,
  TextArea,
  TextInput,
} from "@auction/staff-ui";
import { SIGNED_AGREEMENT_MAX_BYTES, type SignedAgreementErrors } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

type Phase = "editing" | "uploading" | "recording";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: RecordAgreementContext;
  /** Replace an agreement already on record (Administrator only). */
  replace?: boolean;
  /** Records the agreement; the server action by default. */
  record?: (
    input: RecordAgreementInput,
  ) => Promise<ActionResult<{ sellerNetPence: number | null; sale: RecordedSale | null }>>;
  /** Sends the signed PDF to document storage; the upload lifecycle by default. */
  upload?: (file: File) => Promise<{ uploadObjectId: string }>;
  /** The London calendar day; today by default. */
  today?: string;
  /** For the review route: start from a filled draft, with errors shown, or mid-recording. */
  initial?: {
    draft?: Partial<RecordAgreementDraft>;
    fileName?: string;
    showErrors?: boolean;
    phase?: Phase;
  };
  onRecorded?: () => void;
};

const SIGNED_AGREEMENT_KIND = "signed_consignment_agreement";

const defaultUpload = async (file: File) => uploadObjectFile(file, SIGNED_AGREEMENT_KIND);

/**
 * Record a seller's signed paper agreement so a held sale can be paid: the commission it states,
 * the day it was signed, the signed PDF and why it is recorded by staff. What the seller would
 * receive is shown as the commission is typed, priced by the one calculator. Errors are listed
 * at the top and beside each field; the API checks everything again.
 */
export type { RecordAgreementContext };

export function RecordAgreementDialog({
  open,
  onOpenChange,
  context,
  replace = false,
  record = recordSignedAgreementAction,
  upload = defaultUpload,
  today = dayKey(new Date(), LONDON_TIME_ZONE),
  initial,
  onRecorded,
}: Props) {
  const router = useRouter();
  const ids = { commission: useId(), signedOn: useId(), document: useId(), reason: useId() };
  const [draft, setDraft] = useState<RecordAgreementDraft>({
    commissionPercent: "",
    signedOn: "",
    uploadObjectId: null,
    reason: "",
    ...initial?.draft,
  });
  const [fileName, setFileName] = useState<string | null>(initial?.fileName ?? null);
  const [phase, setPhase] = useState<Phase>(initial?.phase ?? "editing");
  const [submits, setSubmits] = useState(initial?.showErrors ? 1 : 0);
  const [serverErrors, setServerErrors] = useState<SignedAgreementErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  const check = useMemo(() => checkRecordAgreement(draft, today), [draft, today]);
  const showErrors = submits > 0;
  const errors: SignedAgreementErrors = showErrors
    ? { ...check.errors, ...serverErrors }
    : serverErrors;
  const summaryItems = showErrors
    ? check.list.map((item) => ({ fieldId: idFor(item.field), message: item.message }))
    : [];
  const preview = previewRecordedAgreement(
    draft.commissionPercent,
    context.hammerPence,
    context.vatSetting,
  );
  const busy = phase !== "editing";

  function idFor(field: keyof SignedAgreementErrors): string {
    switch (field) {
      case "commissionPercent":
        return ids.commission;
      case "signedOn":
        return ids.signedOn;
      case "document":
        return ids.document;
      default:
        return ids.reason;
    }
  }

  const set = (patch: Partial<RecordAgreementDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setServerErrors({});
  };

  async function choose(files: File[]) {
    const file = files[0];
    if (!file) return;
    if (file.type !== "application/pdf" || file.size > SIGNED_AGREEMENT_MAX_BYTES) {
      set({ uploadObjectId: null });
      setFileName(null);
      setServerErrors({ document: "Add the signed agreement as a PDF, up to 20 MB." });
      return;
    }
    setPhase("uploading");
    setFailure(null);
    try {
      const stored = await upload(file);
      set({ uploadObjectId: stored.uploadObjectId });
      setFileName(file.name);
    } catch (error) {
      setServerErrors({
        document: error instanceof Error ? error.message : "The PDF could not be uploaded.",
      });
    } finally {
      setPhase("editing");
    }
  }

  async function submit() {
    setSubmits((n) => n + 1);
    setFailure(null);
    if (check.list.length > 0) return;
    setPhase("recording");
    const result = await record({ lotId: context.lotId, ...draft, replace });
    setPhase("editing");
    if (result.ok) {
      toast.success(recordedToast(context.lot, result.data?.sale ?? null));
      onOpenChange(false);
      onRecorded?.();
      router.refresh();
      return;
    }
    if (handleStaffStepUp(result)) return;
    const fields = Object.fromEntries(
      Object.entries(result.fieldErrors ?? {}).map(([field, list]) => [field, list?.[0]]),
    ) as SignedAgreementErrors;
    setServerErrors(fields);
    if (Object.keys(fields).length === 0) setFailure(result.error);
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      size="md"
      title={replace ? COPY.replaceTitle : COPY.title}
      description={[`${context.lot} · ${context.lotTitle}`, context.sellerName]
        .filter(Boolean)
        .join(" · ")}
      footer={
        <>
          <StaffButton variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {COPY.cancel}
          </StaffButton>
          <StaffButton
            variant="primary"
            onClick={() => void submit()}
            loading={phase === "recording"}
            disabled={phase === "uploading"}
          >
            {phase === "recording" ? COPY.submitting : replace ? COPY.replaceSubmit : COPY.submit}
          </StaffButton>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FormErrorSummary
          errors={summaryItems}
          title={check.summary ?? "Check the agreement"}
          focusKey={submits}
        />
        {failure ? (
          <Notice tone="danger" alert title="The agreement was not recorded">
            {failure}
          </Notice>
        ) : null}
        <Field
          id={ids.commission}
          label={COPY.commission}
          description={COPY.commissionHint}
          error={errors.commissionPercent}
        >
          <div className="max-w-40">
            <TextInput
              inputMode="decimal"
              autoComplete="off"
              value={draft.commissionPercent}
              onChange={(event) => set({ commissionPercent: event.target.value })}
              trailing="%"
              disabled={busy}
            />
          </div>
        </Field>
        <Field id={ids.signedOn} label={COPY.signedOn} error={errors.signedOn}>
          <div className="max-w-48">
            <DateInput
              value={draft.signedOn || null}
              onValueChange={(day) => set({ signedOn: day ?? "" })}
              max={today}
              disabled={busy}
            />
          </div>
        </Field>
        <Field
          id={ids.document}
          label={COPY.document}
          description={COPY.documentHint}
          error={errors.document}
        >
          {fileName ? (
            <div className="flex min-h-control-md items-center justify-between gap-3 rounded-staff-sm border border-staff-line px-3 text-staff-sm">
              <span className="min-w-0 truncate">{fileName}</span>
              <StaffButton
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  set({ uploadObjectId: null });
                  setFileName(null);
                }}
              >
                Choose another
              </StaffButton>
            </div>
          ) : (
            <FileDropzone
              id={ids.document}
              accept="application/pdf"
              kind="file"
              compact
              label={phase === "uploading" ? "Uploading the PDF…" : "Choose the signed PDF"}
              disabled={busy}
              onFiles={(files) => void choose(files)}
            />
          )}
        </Field>
        <Field
          id={ids.reason}
          label={COPY.reason}
          description={COPY.reasonHint}
          error={errors.reason}
        >
          <TextArea
            rows={3}
            value={draft.reason}
            onChange={(event) => set({ reason: event.target.value })}
            disabled={busy}
          />
        </Field>
        {preview.kind === "priced" ? (
          <section aria-label="What the seller would receive" className="flex flex-col gap-2">
            <p className="text-staff-xs text-staff-muted">What the seller would receive</p>
            <SettlementBreakdown
              hammerPence={context.hammerPence}
              commission={{ rateBps: preview.commissionBps, pence: preview.commissionPence }}
              vat={preview.vat}
              netPence={preview.netPence}
              paidOut={false}
              status={{ kind: "ready" }}
              rateSource={{ kind: "recorded_by_staff" }}
              premium={null}
            />
          </section>
        ) : null}
      </form>
    </StaffDialog>
  );
}
