"use client";

import {
  handOverCollectionAction,
  undoHandOverCollectionAction,
} from "@/lib/actions/admin/admin-collection-desk";
import { adminLotFulfilmentReleaseResultAction } from "@/lib/actions/admin/admin-lot-fulfilment";
import {
  ID_TYPE_OPTIONS,
  deskRefusalMessage,
  handOverBlock,
  lotLabel,
  lotReadiness,
  markCollectedLabel,
  newAttemptKey,
  timeRange,
} from "@/lib/admin/collections/desk.vm";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import {
  DetailPanel,
  EnumSelect,
  Field,
  FieldError,
  FormErrorSummary,
  Notice,
  RecordThumbnail,
  StaffButton,
  StaffCheckbox,
  StatusBadge,
  toastUndo,
} from "@auction/staff-ui";
import type { DeskBookingView, DeskIdType } from "@auction/types";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

const ID_FIELD = "desk-id-check";
const ID_TYPE_FIELD = "desk-id-type";

/**
 * Hands works over at the desk. The lots are ticked so one left behind can be unticked. "Mark
 * collected" stays off until every ticked lot is released (with the reason, and Release offered in
 * place) and the photo ID is ticked and its type chosen; only the type is kept, never the number or
 * a copy. A hand-over can be undone from the toast for ten seconds and from the visit after that.
 */
export function DeskHandOverPanel({
  booking,
  onClose,
}: {
  booking: DeskBookingView | null;
  onClose: () => void;
}) {
  // The panel keeps its content while it slides away.
  const [shown, setShown] = useState(booking);
  if (booking && booking !== shown) setShown(booking);
  const open = booking !== null;
  return (
    <DetailPanel
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={shown ? `Hand over to ${shown.collector.name}` : "Hand over"}
      description={shown ? `${shown.buyer.name} · ${shown.reference}` : undefined}
      {...(shown
        ? {
            meta: [
              { label: "Time", value: timeRange(shown) },
              {
                label: "Collector",
                value:
                  shown.collector.kind === "third_party"
                    ? `${shown.collector.name} (third party)`
                    : shown.collector.name,
              },
            ],
          }
        : {})}
    >
      {shown ? (
        <HandOverForm key={shown.id + shown.version} booking={shown} onClose={onClose} />
      ) : null}
    </DetailPanel>
  );
}

type Errors = { fieldId: string; message: string }[];

function HandOverForm({ booking, onClose }: { booking: DeskBookingView; onClose: () => void }) {
  const router = useRouter();
  const active = useMemo(() => booking.lots.filter((lot) => lot.active), [booking.lots]);
  const [ticked, setTicked] = useState<readonly string[]>(active.map((lot) => lot.lotId));
  const [idChecked, setIdChecked] = useState(false);
  const [idType, setIdType] = useState<DeskIdType | null>(null);
  const [errors, setErrors] = useState<Errors>([]);
  const [attempts, setAttempts] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const key = useRef(newAttemptKey());

  const chosen = active.filter((lot) => ticked.includes(lot.lotId));
  const blocked = handOverBlock({ ticked: chosen, idChecked });
  const thirdParty = booking.collector.kind === "third_party";

  async function release(lotId: string) {
    setReleasing(lotId);
    const result = await adminLotFulfilmentReleaseResultAction(lotId, {});
    setReleasing(null);
    if (result.ok) router.refresh();
    else if (!handleStaffStepUp(result)) setFailure(result.error);
  }

  async function submit() {
    const found: Errors = [];
    if (!idChecked) {
      found.push({ fieldId: ID_FIELD, message: "Tick that you checked the photo ID." });
    }
    if (!idType) found.push({ fieldId: ID_TYPE_FIELD, message: "Choose the type of ID." });
    if (found.length > 0 || !idType) {
      setErrors(found);
      setAttempts((n) => n + 1);
      return;
    }
    setErrors([]);
    setFailure(null);
    setBusy(true);
    const result = await handOverCollectionAction(
      booking.id,
      { lotIds: [...ticked], idCheck: { confirmed: true, type: idType } },
      key.current,
    );
    setBusy(false);
    if (result.ok) {
      onClose();
      router.refresh();
      toastUndo({
        title: `${chosen.length === 1 && chosen[0] ? chosen[0].title : `${chosen.length} lots`} collected`,
        description: `${booking.reference} handed over to ${booking.collector.name}`,
        onUndo: () => void undo(),
      });
      return;
    }
    if (handleStaffStepUp(result)) return;
    // A new attempt after a refusal is a new request: the key it was sent with is spent.
    key.current = newAttemptKey();
    setFailure(deskRefusalMessage(result.errorCode, result.error, result.meta));
    if (result.errorCode === "booking_changed") router.refresh();
  }

  async function undo() {
    const result = await undoHandOverCollectionAction(booking.id, newAttemptKey());
    if (result.ok) router.refresh();
    else if (!handleStaffStepUp(result)) {
      setFailure(deskRefusalMessage(result.errorCode, result.error));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <FormErrorSummary
        errors={errors}
        focusKey={attempts}
        title={`Check ${errors.length} ${errors.length === 1 ? "thing" : "things"} before handing over`}
      />
      {failure ? (
        <Notice tone="danger" title={failure} alert>
          {null}
        </Notice>
      ) : null}

      <section aria-labelledby="hand-over-lots" className="flex flex-col gap-3">
        <h3 id="hand-over-lots" className="text-staff-sm font-semibold text-staff-fg">
          Lots
        </h3>
        <ul className="flex flex-col divide-y divide-staff-line-subtle">
          {active.map((lot) => {
            const readiness = lotReadiness(lot);
            const id = `desk-lot-${lot.lotId}`;
            return (
              <li key={lot.lotId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <StaffCheckbox
                  id={id}
                  checked={ticked.includes(lot.lotId)}
                  onCheckedChange={(on) =>
                    setTicked((current) =>
                      on === true
                        ? [...current, lot.lotId]
                        : current.filter((x) => x !== lot.lotId),
                    )
                  }
                />
                <RecordThumbnail src={lot.image} title={lot.title} className="size-10" />
                <label htmlFor={id} className="min-w-0 flex-1 text-staff-sm text-staff-fg">
                  {lotLabel(lot)}
                </label>
                <StatusBadge tone={readiness.tone}>{readiness.label}</StatusBadge>
                {lot.released ? null : (
                  <StaffButton
                    variant="secondary"
                    size="sm"
                    loading={releasing === lot.lotId}
                    onClick={() => release(lot.lotId)}
                  >
                    Release
                  </StaffButton>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-staff-xs text-staff-muted">
          Untick a lot to leave it behind. It stays with us to collect another time.
        </p>
      </section>

      <section aria-labelledby="hand-over-id" className="flex flex-col gap-3">
        <h3 id="hand-over-id" className="text-staff-sm font-semibold text-staff-fg">
          Photo ID
        </h3>
        {thirdParty ? (
          <Notice tone="info" title="A third party is collecting">
            {booking.buyer.name} authorised {booking.collector.name} when they booked. The name on
            the ID must match.
          </Notice>
        ) : null}
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <StaffCheckbox
              id={ID_FIELD}
              checked={idChecked}
              onCheckedChange={(on) => {
                setIdChecked(on === true);
                setErrors((list) => list.filter((e) => e.fieldId !== ID_FIELD));
              }}
              aria-invalid={errors.some((e) => e.fieldId === ID_FIELD) || undefined}
              className="mt-0.5"
            />
            <label htmlFor={ID_FIELD} className="text-staff-sm text-staff-fg">
              I checked photo ID and the name matches {booking.collector.name}
            </label>
          </div>
          {errors.find((e) => e.fieldId === ID_FIELD) ? (
            <FieldError>{errors.find((e) => e.fieldId === ID_FIELD)?.message}</FieldError>
          ) : null}
        </div>
        <Field
          id={ID_TYPE_FIELD}
          label="Type of ID"
          description="We record the type, who checked it and when. Never the number, and we don't keep a copy."
          error={errors.find((e) => e.fieldId === ID_TYPE_FIELD)?.message}
        >
          <EnumSelect
            value={idType}
            onValueChange={(value) => {
              setIdType(value);
              setErrors((list) => list.filter((e) => e.fieldId !== ID_TYPE_FIELD));
            }}
            options={ID_TYPE_OPTIONS}
            placeholder="Choose the type of ID"
          />
        </Field>
      </section>

      <div className="sticky bottom-0 -mx-1 flex flex-wrap justify-end gap-2 border-t border-staff-line bg-staff-surface px-1 pt-4">
        <StaffButton variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </StaffButton>
        <StaffButton
          variant="primary"
          loading={busy}
          onClick={submit}
          {...(blocked && blocked !== "Confirm the photo ID check first."
            ? { disabledReason: blocked }
            : {})}
        >
          {markCollectedLabel(chosen)}
        </StaffButton>
      </div>
    </div>
  );
}
