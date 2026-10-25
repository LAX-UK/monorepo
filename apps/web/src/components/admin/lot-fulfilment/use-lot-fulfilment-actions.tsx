"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  adminLotFulfilmentCollectedResultAction,
  adminLotFulfilmentDeliveredResultAction,
  adminLotFulfilmentReadyForCollectionResultAction,
  adminLotFulfilmentReleaseResultAction,
  adminLotFulfilmentShipResultAction,
} from "@/lib/actions/admin";
import type { LotFulfilmentStaffRow } from "@/lib/admin/lot-fulfilment-staff-list.vm";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import {
  Field,
  FormErrorSummary,
  Notice,
  type OverflowAction,
  StaffButton,
  StaffDialog,
  TextArea,
  TextInput,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useCallback, useId, useRef, useState, useTransition } from "react";

type StepField = {
  name: string;
  label: string;
  description?: string;
  optional?: boolean;
  multiline?: boolean;
  /** What to say when a required field is empty. */
  missing?: string;
  maxLength: number;
};

type StepForm = {
  row: LotFulfilmentStaffRow;
  title: string;
  description: string;
  confirmLabel: string;
  fields: StepField[];
  run: (values: Record<string, string>) => Promise<ActionResult<void>>;
  success: string;
};

/** A fulfilment step that needs details (carrier and tracking, who collected): fields, then confirm. */
function StepDialog({ form, onClose }: { form: StepForm | null; onClose: () => void }) {
  const router = useRouter();
  const id = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attempts, setAttempts] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const validate = (next: Record<string, string>) => {
    const found: Record<string, string> = {};
    for (const field of form?.fields ?? []) {
      if (!field.optional && !(next[field.name] ?? "").trim()) {
        found[field.name] = field.missing ?? `Enter ${field.label.toLowerCase()}.`;
      }
    }
    return found;
  };

  const submit = () => {
    if (!form) return;
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setAttempts((n) => n + 1);
      return;
    }
    setFailure(null);
    startTransition(async () => {
      const result = await form.run(values);
      if (result.ok) {
        onClose();
        notify.success(form.success);
        router.refresh();
        return;
      }
      const fieldErrors = Object.fromEntries(
        Object.entries(result.fieldErrors ?? {}).flatMap(([name, messages]) =>
          messages?.[0] ? [[name, messages[0]]] : [],
        ),
      );
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        setAttempts((n) => n + 1);
      } else {
        setFailure(result.error);
      }
    });
  };

  const summary = (form?.fields ?? [])
    .filter((field) => errors[field.name])
    .map((field) => ({ fieldId: `${id}-${field.name}`, message: errors[field.name] as string }));

  return (
    <StaffDialog
      open={form !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={form?.title ?? ""}
      description={form?.description}
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton ref={cancelRef} variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </StaffButton>
          <StaffButton variant="primary" loading={busy} onClick={submit}>
            {form?.confirmLabel ?? "Save"}
          </StaffButton>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {failure ? (
          <Notice tone="danger" alert title="That did not go through">
            {failure}
          </Notice>
        ) : null}
        <FormErrorSummary errors={summary} focusKey={attempts} />
        {(form?.fields ?? []).map((field) => (
          <Field
            key={field.name}
            id={`${id}-${field.name}`}
            label={field.label}
            {...(field.description ? { description: field.description } : {})}
            optional={field.optional ?? false}
            error={errors[field.name] ?? null}
            disabled={busy}
          >
            {field.multiline ? (
              <TextArea
                value={values[field.name] ?? ""}
                maxLength={field.maxLength}
                onChange={(event) => {
                  const next = { ...values, [field.name]: event.target.value };
                  setValues(next);
                  if (attempts > 0) setErrors(validate(next));
                }}
              />
            ) : (
              <TextInput
                value={values[field.name] ?? ""}
                maxLength={field.maxLength}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submit();
                  }
                }}
                onChange={(event) => {
                  const next = { ...values, [field.name]: event.target.value };
                  setValues(next);
                  if (attempts > 0) setErrors(validate(next));
                }}
              />
            )}
          </Field>
        ))}
      </form>
    </StaffDialog>
  );
}

/**
 * A sold lot's next fulfilment step, the same from a queue row's `…` menu and the record panel:
 * approve release, ship or ready for collection, delivered, collected. Steps that need details
 * open a short form; the rest confirm first. Failures stay in the dialog.
 */
export function useLotFulfilmentActions() {
  const confirm = useStaffConfirm();
  const { ask } = confirm;
  const [form, setForm] = useState<StepForm | null>(null);

  const release = useCallback(
    (row: LotFulfilmentStaffRow) =>
      setForm({
        row,
        title: `Release ${row.title} to the buyer?`,
        description:
          "Payment has been captured. Releasing lets the lot be shipped or collected. This cannot be undone.",
        confirmLabel: "Release lot",
        fields: [
          {
            name: "notes",
            label: "Notes for the team",
            description: "Kept with the lot's fulfilment record.",
            optional: true,
            multiline: true,
            maxLength: 2000,
          },
        ],
        run: (values) =>
          adminLotFulfilmentReleaseResultAction(row.id, { notes: values.notes ?? "" }),
        success: `${row.title} released`,
      }),
    [],
  );

  const ship = useCallback(
    (row: LotFulfilmentStaffRow) =>
      setForm({
        row,
        title: `Ship ${row.title}`,
        description: "The buyer is emailed the carrier and tracking number.",
        confirmLabel: "Mark in transit",
        fields: [
          {
            name: "carrier",
            label: "Carrier",
            missing: "Enter the carrier.",
            maxLength: 200,
          },
          {
            name: "trackingNumber",
            label: "Tracking number",
            missing: "Enter the tracking number.",
            maxLength: 200,
          },
        ],
        run: (values) =>
          adminLotFulfilmentShipResultAction(row.id, {
            carrier: values.carrier ?? "",
            trackingNumber: values.trackingNumber ?? "",
          }),
        success: `${row.title} is in transit`,
      }),
    [],
  );

  const collected = useCallback(
    (row: LotFulfilmentStaffRow) =>
      setForm({
        row,
        title: `Record that ${row.title} was collected`,
        description: "Closes the lot's fulfilment.",
        confirmLabel: "Mark collected",
        fields: [
          {
            name: "collectedBy",
            label: "Collected by",
            description: "The name of the person who took the lot.",
            missing: "Enter who collected the lot.",
            maxLength: 200,
          },
        ],
        run: (values) =>
          adminLotFulfilmentCollectedResultAction(row.id, {
            collectedBy: values.collectedBy ?? "",
          }),
        success: `${row.title} collected`,
      }),
    [],
  );

  const readyForCollection = useCallback(
    (row: LotFulfilmentStaffRow) =>
      ask({
        title: `Mark ${row.title} ready for collection?`,
        description: "The buyer is told the lot is ready to collect.",
        confirmLabel: "Ready for collection",
        run: () => adminLotFulfilmentReadyForCollectionResultAction(row.id),
        success: `${row.title} is ready for collection`,
      }),
    [ask],
  );

  const delivered = useCallback(
    (row: LotFulfilmentStaffRow) =>
      ask({
        title: `Mark ${row.title} delivered?`,
        description: "Closes the lot's fulfilment.",
        confirmLabel: "Mark delivered",
        run: () => adminLotFulfilmentDeliveredResultAction(row.id),
        success: `${row.title} delivered`,
      }),
    [ask],
  );

  /** The step a lot is waiting for, as the panel's primary action; null when none. */
  const nextStep = useCallback(
    (row: LotFulfilmentStaffRow): { label: string; run: () => void } | null => {
      switch (row.step) {
        case "awaiting_release":
          return { label: "Release lot", run: () => release(row) };
        case "released":
          return { label: "Ship lot", run: () => ship(row) };
        case "in_transit":
          return { label: "Mark delivered", run: () => delivered(row) };
        case "ready_for_collection":
          return { label: "Mark collected", run: () => collected(row) };
        default:
          return null;
      }
    },
    [release, ship, delivered, collected],
  );

  const actionsFor = useCallback(
    (row: LotFulfilmentStaffRow): OverflowAction[] => {
      switch (row.step) {
        case "awaiting_payment":
          return [
            {
              id: "release",
              label: "Release lot",
              onSelect: () => {},
              disabledReason: "Opens once the buyer has paid",
            },
          ];
        case "awaiting_release":
          return [{ id: "release", label: "Release lot", onSelect: () => release(row) }];
        case "released":
          return [
            { id: "ship", label: "Ship lot", onSelect: () => ship(row) },
            {
              id: "ready",
              label: "Ready for collection",
              onSelect: () => readyForCollection(row),
            },
          ];
        case "in_transit":
          return [{ id: "delivered", label: "Mark delivered", onSelect: () => delivered(row) }];
        case "ready_for_collection":
          return [{ id: "collected", label: "Mark collected", onSelect: () => collected(row) }];
        default:
          return [];
      }
    },
    [release, ship, readyForCollection, delivered, collected],
  );

  const dialogs = (
    <>
      {confirm.dialog}
      <StepDialog
        key={form ? `${form.row.id}-${form.title}` : "closed"}
        form={form}
        onClose={() => setForm(null)}
      />
    </>
  );

  return { actionsFor, nextStep, dialogs, release, ship, readyForCollection, delivered, collected };
}
