"use client";

import {
  findDataRequestAccountAction,
  logDataRequestAction,
} from "@/lib/actions/admin/admin-data-requests";
import {
  type FoundAccount,
  LOG_REQUEST_MESSAGES,
  type LogRequestDraft,
  type LogRequestField,
  emptyLogRequest,
  isLogRequestDirty,
  oldReceivedWarning,
  previewDueOn,
  validateLogRequest,
} from "@/lib/admin/data-requests/data-request-forms";
import { dataRequestHref } from "@/lib/admin/data-requests/data-requests-search";
import {
  ALL_CHANNELS,
  ALL_PRODUCTS,
  ALL_REASONS,
  CHANNEL_LABELS,
  PRODUCT_DETAILS,
  REASON_HINTS,
  REASON_LABELS,
  formatDay,
} from "@/lib/admin/data-requests/data-requests.vm";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import type {
  DataRequestProduct,
  DataRequestRecord,
} from "@auction/identity-contracts/data-requests";
import {
  ChoiceFieldset,
  ChoiceRow,
  DateInput,
  EnumSelect,
  Field,
  FormErrorSummary,
  Notice,
  StaffAvatar,
  StaffButton,
  StaffCheckbox,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
  TextArea,
  TextInput,
  UnsavedChangesDialog,
  confirmDiscardChanges,
  useUnsavedChanges,
} from "@auction/staff-ui";
import { SegmentedControl } from "@auction/staff-ui";
import { Clock, X } from "@auction/staff-ui/icons";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

export type LogDataRequestApi = {
  log: (input: unknown) => Promise<ActionResult<DataRequestRecord>>;
  findAccount: (email: string) => Promise<ActionResult<FoundAccount | null>>;
};

const SERVER_API: LogDataRequestApi = {
  log: logDataRequestAction,
  findAccount: findDataRequestAccountAction,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The London day, so "received" can't be in the future. */
  today: string;
  api?: LogDataRequestApi;
};

const DISCARD_PROMPT = {
  title: "Discard this request?",
  description: "The request has not been logged and what you entered will be lost.",
  confirmLabel: "Discard",
};

const REASON_OPTIONS = ALL_REASONS.map((value) => ({
  value,
  label: REASON_LABELS[value],
  description: REASON_HINTS[value],
}));
const CHANNEL_OPTIONS = ALL_CHANNELS.map((value) => ({ value, label: CHANNEL_LABELS[value] }));

/**
 * Logs a request that came by email, post or phone, or a full copy that needs a person. The
 * person is a LAX account found by full email address, or a name and contact for someone with
 * no account. The due date is shown as the ICO month rule works it out, before anything is
 * saved. Fields are checked on submit, with an error summary and no lost input.
 */
export function LogDataRequestDialog({ open, onOpenChange, today, api = SERVER_API }: Props) {
  const router = useRouter();
  const ids = useId();
  const formId = `${ids}-form`;
  const fieldIds: Record<LogRequestField, string> = {
    person: `${ids}-person`,
    contactName: `${ids}-contact-name`,
    contactDetail: `${ids}-contact-detail`,
    receivedOn: `${ids}-received`,
    products: `${ids}-products`,
    notes: `${ids}-notes`,
  };
  const [draft, setDraft] = useState<LogRequestDraft>(() => emptyLogRequest(today));
  const [email, setEmail] = useState("");
  const [lookup, setLookup] = useState<{ state: "idle" | "searching" | "none" | "failed" }>({
    state: "idle",
  });
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const dirty = open && isLogRequestDirty(draft, today);
  const guard = useUnsavedChanges(dirty, { interceptBack: false });

  const reset = () => {
    setDraft(emptyLogRequest(today));
    setEmail("");
    setLookup({ state: "idle" });
    setAttempted(false);
    setFailedSubmits(0);
    setFailure(null);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog closes
  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const errors = attempted ? validateLogRequest(draft, today) : {};
  const summary = (Object.keys(errors) as LogRequestField[]).flatMap((field) =>
    errors[field] ? [{ fieldId: fieldIds[field], message: errors[field] as string }] : [],
  );
  const due = previewDueOn(draft);
  const oldWarning = oldReceivedWarning(draft.receivedOn, today);
  const set = <K extends keyof LogRequestDraft>(key: K, value: LogRequestDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function requestClose() {
    if (submitting) return;
    if (dirty && !(await confirmDiscardChanges(DISCARD_PROMPT))) return;
    onOpenChange(false);
  }

  async function findAccount() {
    if (!email.includes("@")) {
      setLookup({ state: "none" });
      return;
    }
    setLookup({ state: "searching" });
    const result = await api.findAccount(email);
    if (!result.ok) {
      setLookup({ state: "failed" });
      return;
    }
    if (result.data) {
      set("account", result.data);
      setLookup({ state: "idle" });
    } else {
      setLookup({ state: "none" });
    }
  }

  async function submit() {
    setAttempted(true);
    if (Object.keys(validateLogRequest(draft, today)).length > 0) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setFailure(null);
    setSubmitting(true);
    const notes = draft.notes.trim();
    const result = await api.log({
      person:
        draft.personMode === "account" && draft.account
          ? { kind: "account", subjectId: draft.account.subjectId }
          : { kind: "contact", name: draft.contactName.trim(), detail: draft.contactDetail.trim() },
      reason: draft.reason,
      channel: draft.channel,
      receivedOn: draft.receivedOn,
      identity: draft.identity,
      products: draft.products,
      ...(notes ? { notes } : {}),
    });
    setSubmitting(false);
    if (!result.ok || !result.data) {
      setFailure(result.ok ? "The request wasn't logged. Try again." : result.error);
      return;
    }
    const { request } = result.data;
    notify.success(
      request.dueOn
        ? `${request.reference} logged · due ${formatDay(request.dueOn)}`
        : `${request.reference} logged · starts when ID arrives`,
    );
    await guard.release();
    reset();
    onOpenChange(false);
    router.push(dataRequestHref(request.reference, null));
  }

  const toggleProduct = (product: DataRequestProduct, on: boolean) =>
    set(
      "products",
      ALL_PRODUCTS.filter((p) => (p === product ? on : draft.products.includes(p))),
    );

  return (
    <>
      <StaffDialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else void requestClose();
        }}
        size="md"
        title="Log a manual request"
        description="For a full copy, a request after account deletion, or one that came by email, post or phone."
        footer={
          <>
            <StaffButton
              variant="secondary"
              disabled={submitting}
              onClick={() => void requestClose()}
            >
              Cancel
            </StaffButton>
            <StaffButton type="submit" form={formId} variant="primary" loading={submitting}>
              Log request
            </StaffButton>
          </>
        }
      >
        <form
          id={formId}
          noValidate
          aria-label="Log a manual request"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <FormErrorSummary
            errors={summary}
            focusKey={failedSubmits}
            title={`Fix ${summary.length} ${summary.length === 1 ? "thing" : "things"} to log this request`}
          />
          {failure ? (
            <Notice tone="danger" alert title="The request wasn't logged">
              {failure}
            </Notice>
          ) : null}

          <div className="flex flex-col gap-2">
            <span className="text-staff-sm font-medium text-staff-fg">Person</span>
            <SegmentedControl
              label="Who the request is from"
              value={draft.personMode}
              disabled={submitting}
              onValueChange={(next) => set("personMode", next)}
              options={[
                { value: "account", label: "LAX account" },
                { value: "contact", label: "No account or account deleted" },
              ]}
            />
            {draft.personMode === "account" ? (
              draft.account ? (
                <div className="flex items-center gap-3 rounded-staff-md border border-staff-line bg-staff-surface p-3">
                  <StaffAvatar name={draft.account.name} />
                  <span className="flex min-w-0 flex-1 flex-col text-staff-sm">
                    <span className="font-medium text-staff-fg">{draft.account.name}</span>
                    <span className="text-staff-muted">
                      {email || "LAX account"} · {draft.account.status}
                    </span>
                  </span>
                  <StaffButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Change person"
                    disabled={submitting}
                    onClick={() => set("account", null)}
                  >
                    <X aria-hidden />
                  </StaffButton>
                </div>
              ) : (
                <Field
                  label="Full email address"
                  labelHidden
                  id={fieldIds.person}
                  error={
                    errors.person ??
                    (lookup.state === "none"
                      ? 'No LAX account has that email address. Check it, or switch to "No account".'
                      : lookup.state === "failed"
                        ? "The account search didn't answer. Try again in a moment."
                        : null)
                  }
                  description="Search takes the full email address, never part of one."
                  disabled={submitting}
                >
                  <div className="flex gap-2">
                    <TextInput
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      placeholder="Full email address"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (lookup.state !== "idle") setLookup({ state: "idle" });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void findAccount();
                        }
                      }}
                    />
                    <StaffButton
                      variant="secondary"
                      loading={lookup.state === "searching"}
                      disabled={email.trim() === ""}
                      onClick={() => void findAccount()}
                    >
                      Find account
                    </StaffButton>
                  </div>
                </Field>
              )
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Name"
                  id={fieldIds.contactName}
                  error={errors.contactName}
                  disabled={submitting}
                >
                  <TextInput
                    value={draft.contactName}
                    maxLength={200}
                    onChange={(event) => set("contactName", event.target.value)}
                  />
                </Field>
                <Field
                  label="Email or postal address"
                  id={fieldIds.contactDetail}
                  error={errors.contactDetail}
                  disabled={submitting}
                >
                  <TextInput
                    value={draft.contactDetail}
                    maxLength={500}
                    onChange={(event) => set("contactDetail", event.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reason" disabled={submitting}>
              <EnumSelect
                value={draft.reason}
                options={REASON_OPTIONS}
                disabled={submitting}
                onValueChange={(next) => set("reason", next)}
              />
            </Field>
            <Field label="Channel" disabled={submitting}>
              <EnumSelect
                value={draft.channel}
                options={CHANNEL_OPTIONS}
                disabled={submitting}
                onValueChange={(next) => set("channel", next)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Received"
              id={fieldIds.receivedOn}
              description="The day it reached us, in any form"
              error={errors.receivedOn}
              disabled={submitting}
            >
              <DateInput
                value={draft.receivedOn}
                max={today}
                onValueChange={(day) => set("receivedOn", day)}
              />
            </Field>
            <ChoiceFieldset legend="Identity" disabled={submitting}>
              <StaffRadioGroup
                value={draft.identity}
                disabled={submitting}
                onValueChange={(next) =>
                  set("identity", next === "asked_for_proof" ? "asked_for_proof" : "confirmed")
                }
              >
                <ChoiceRow
                  htmlFor={`${ids}-id-confirmed`}
                  label="Confirmed"
                  description="Signed-in request, or from the account email"
                  disabled={submitting}
                  control={<StaffRadio id={`${ids}-id-confirmed`} value="confirmed" />}
                />
                <ChoiceRow
                  htmlFor={`${ids}-id-asked`}
                  label="We've asked for proof"
                  description="The clock starts when it arrives"
                  disabled={submitting}
                  control={<StaffRadio id={`${ids}-id-asked`} value="asked_for_proof" />}
                />
              </StaffRadioGroup>
            </ChoiceFieldset>
          </div>
          {oldWarning ? (
            <Notice tone="warning" title="Received more than a month ago">
              {oldWarning}
            </Notice>
          ) : null}

          <ChoiceFieldset
            legend="Products"
            id={fieldIds.products}
            error={errors.products}
            disabled={submitting}
          >
            <div className="flex flex-wrap gap-x-6">
              {ALL_PRODUCTS.map((product) => (
                <ChoiceRow
                  key={product}
                  htmlFor={`${ids}-product-${product}`}
                  label={PRODUCT_DETAILS[product].name.replace("LAX ", "")}
                  disabled={submitting}
                  control={
                    <StaffCheckbox
                      id={`${ids}-product-${product}`}
                      checked={draft.products.includes(product)}
                      disabled={submitting}
                      onCheckedChange={(next) => toggleProduct(product, next === true)}
                    />
                  }
                />
              ))}
            </div>
          </ChoiceFieldset>

          <Field
            label="Notes"
            id={fieldIds.notes}
            description="Internal. Don't paste the person's data here."
            optional={draft.reason !== "other"}
            error={errors.notes}
            disabled={submitting}
          >
            <TextArea
              rows={3}
              value={draft.notes}
              maxLength={2000}
              onChange={(event) => set("notes", event.target.value)}
            />
          </Field>

          <p
            className="flex items-center gap-2 rounded-staff-md bg-staff-sunken px-3 py-2 text-staff-sm text-staff-fg"
            aria-live="polite"
          >
            <Clock aria-hidden className="size-4 shrink-0 text-staff-muted" />
            {due && draft.receivedOn ? (
              <span>
                Due <b className="font-semibold">{formatDay(due)}</b> · one calendar month from{" "}
                {formatDay(draft.receivedOn)}
              </span>
            ) : draft.identity === "asked_for_proof" ? (
              <span>No due date yet. It starts the day the proof of identity arrives.</span>
            ) : (
              <span>{LOG_REQUEST_MESSAGES.receivedMissing}</span>
            )}
          </p>
        </form>
      </StaffDialog>
      <UnsavedChangesDialog guard={guard} />
    </>
  );
}
