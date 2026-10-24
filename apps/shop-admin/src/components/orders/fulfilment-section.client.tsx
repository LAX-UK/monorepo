"use client";

import { StaffMutationError } from "@/components/staff-mutation-error";
import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  recordFulfilmentPossession,
  updateFulfilment,
} from "@/server/application/admin-operations-actions.server";
import {
  type FulfilmentEditErrors,
  checkFulfilmentEdit,
  fulfilmentEditPermission,
  fulfilmentMoveKind,
  movesNeedTracking,
} from "@/server/domain/fulfilment-edit.vm";
import {
  fulfilmentNextOptions,
  fulfilmentOptionLabel,
  presentFulfilmentStatus,
} from "@/server/domain/order-detail.vm";
import {
  type AdminOrderDetail,
  FULFILMENT_CARRIER_MAX_LENGTH,
  FULFILMENT_TRACKING_NUMBER_MAX_LENGTH,
} from "@auction/shop-contracts";
import type { ShopFulfilmentStatus } from "@auction/shop-domain";
import {
  DateTimeInput,
  EnumSelect,
  Field,
  FieldRow,
  FormActions,
  KeyValueList,
  MappedStatusBadge,
  Section,
  StaffButton,
  TextInput,
  formatStaffDateTime,
  useBeforeUnloadGuard,
} from "@auction/staff-ui";
import { PenLine } from "@auction/staff-ui/icons";
import { useState } from "react";

type FulfilmentRecord = NonNullable<AdminOrderDetail["fulfilmentRecord"]>;

/**
 * The order's fulfilment: its status, tracking and possession as facts, and Edit to move it on in
 * place. Only the statuses it can reach next are offered. Moving to a delivered, collected or
 * stored status records when the customer took possession; moving into the post records the
 * carrier and tracking number. Staff who cannot change fulfilment see the facts without Edit.
 */
export function FulfilmentSection({
  fulfilment,
  fallbackOption,
  paidAt,
  canEdit,
}: {
  fulfilment: FulfilmentRecord | null;
  /** The order's chosen delivery option, shown before a fulfilment record exists. */
  fallbackOption: string;
  paidAt: string | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const options = fulfilment ? fulfilmentNextOptions(fulfilment.status) : [];
  const permission = fulfilmentEditPermission({ canEdit, nextStatusCount: options.length });

  if (!fulfilment) {
    return (
      <Section title="Fulfilment" description={fulfilmentOptionLabel(fallbackOption)}>
        <p className="text-staff-sm text-staff-muted">Fulfilment starts once the order is paid.</p>
      </Section>
    );
  }

  return (
    <Section
      id="fulfilment"
      title="Fulfilment"
      description={fulfilmentOptionLabel(fulfilment.option)}
      action={
        <>
          <MappedStatusBadge status={fulfilment.status} present={presentFulfilmentStatus} />
          {permission.kind === "editable" && !editing ? (
            <StaffButton
              variant="ghost"
              size="sm"
              icon={<PenLine aria-hidden />}
              onClick={() => setEditing(true)}
            >
              Edit
            </StaffButton>
          ) : null}
        </>
      }
    >
      {editing ? (
        <FulfilmentEditForm
          fulfilment={fulfilment}
          paidAt={paidAt}
          onDone={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <KeyValueList
            items={[
              {
                label: "Tracking",
                value: fulfilment.trackingNumber
                  ? `${fulfilment.carrier ?? "Carrier"} ${fulfilment.trackingNumber}`
                  : null,
                ...(fulfilment.trackingNumber ? { copyValue: fulfilment.trackingNumber } : {}),
              },
              {
                label: "Possession",
                value: fulfilment.possessionAt
                  ? formatStaffDateTime(fulfilment.possessionAt, { zoneLabel: true })
                  : "Not recorded",
              },
              { label: "Last updated", value: formatStaffDateTime(fulfilment.updatedAt) },
            ]}
          />
          {permission.kind === "final" ? (
            <p className="text-staff-sm text-staff-muted">
              {presentFulfilmentStatus(fulfilment.status).label} is final, so there is nothing
              further to change.
            </p>
          ) : null}
        </div>
      )}
    </Section>
  );
}

function FulfilmentEditForm({
  fulfilment,
  paidAt,
  onDone,
}: {
  fulfilment: FulfilmentRecord;
  paidAt: string | null;
  onDone: () => void;
}) {
  const mutation = useAdminMutation();
  const options = fulfilmentNextOptions(fulfilment.status);
  const possessionRecorded = Boolean(fulfilment.possessionAt);
  const [status, setStatus] = useState<ShopFulfilmentStatus | null>(null);
  const [carrier, setCarrier] = useState(fulfilment.carrier ?? "");
  const [tracking, setTracking] = useState(fulfilment.trackingNumber ?? "");
  const [possessionAt, setPossessionAt] = useState<string | null>(null);
  const [submits, setSubmits] = useState(0);
  const [now] = useState(() => new Date());

  const kind = status ? fulfilmentMoveKind(status, { possessionRecorded }) : null;
  const showTracking = status !== null && movesNeedTracking(status);
  const showPossession = kind === "possession";
  const dirty = status !== null;
  useBeforeUnloadGuard(dirty);

  const checked = checkFulfilmentEdit({
    status,
    carrier,
    tracking,
    possessionAt,
    possessionRecorded,
    paidAt,
    now,
  });
  // Errors show after the first Save, then clear as each field is put right.
  const errors: FulfilmentEditErrors = submits > 0 && !checked.ok ? checked.errors : {};

  const save = async () => {
    setSubmits((count) => count + 1);
    if (!checked.ok) return;
    const request = checked.request;
    const ok = await mutation.run(
      () =>
        request.kind === "possession"
          ? recordFulfilmentPossession({
              fulfilmentId: fulfilment.fulfilmentId,
              status: request.status,
              possessionAt: request.possessionAt,
              idempotencyKey: mutation.idempotencyKey,
            })
          : updateFulfilment({
              fulfilmentId: fulfilment.fulfilmentId,
              status: request.status,
              ...(request.carrier ? { carrier: request.carrier } : {}),
              ...(request.trackingNumber ? { trackingNumber: request.trackingNumber } : {}),
              idempotencyKey: mutation.idempotencyKey,
            }),
      request.kind === "possession"
        ? "Possession recorded"
        : `Fulfilment moved to ${presentFulfilmentStatus(request.status).label.toLowerCase()}`,
    );
    if (ok) onDone();
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <StaffMutationError mutation={mutation} />
      <Field label="Move to" error={errors.status}>
        <EnumSelect
          value={status}
          onValueChange={setStatus}
          options={options}
          placeholder="Choose the next status"
        />
      </Field>
      {showPossession ? (
        <Field
          label="Customer took possession"
          description="When the customer received or collected the work. It starts their cancellation period."
          error={errors.possessionAt}
        >
          <DateTimeInput
            value={possessionAt}
            onValueChange={setPossessionAt}
            {...(paidAt ? { min: paidAt } : {})}
            max={now.toISOString()}
          />
        </Field>
      ) : null}
      {showTracking ? (
        <FieldRow>
          <Field label="Carrier" optional error={errors.carrier}>
            <TextInput
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
              maxLength={FULFILMENT_CARRIER_MAX_LENGTH}
              placeholder="Royal Mail"
            />
          </Field>
          <Field label="Tracking number" optional error={errors.tracking}>
            <TextInput
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
              maxLength={FULFILMENT_TRACKING_NUMBER_MAX_LENGTH}
              autoComplete="off"
            />
          </Field>
        </FieldRow>
      ) : null}
      <FormActions>
        <StaffButton variant="ghost" onClick={onDone} disabled={mutation.pending}>
          Cancel
        </StaffButton>
        <StaffButton type="submit" variant="primary" loading={mutation.pending}>
          {showPossession ? "Record possession" : "Save"}
        </StaffButton>
      </FormActions>
    </form>
  );
}
