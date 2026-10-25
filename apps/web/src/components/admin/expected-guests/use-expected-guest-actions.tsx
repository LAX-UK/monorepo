"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  adminAssignPaddleResultAction,
  adminClearPaddleResultAction,
  adminSaleroomCheckInResultAction,
} from "@/lib/actions/admin";
import type { AdminExpectedGuestRow } from "@/lib/data/http/admin-expected-guests.server";
import { saleroomCheckInErrorMessage } from "@/lib/saleroom/check-in-error-messages";
import { notify } from "@/lib/ui/notify";
import {
  EnumSelect,
  Field,
  Notice,
  type OverflowAction,
  StaffButton,
  StaffDialog,
  TextInput,
} from "@auction/staff-ui";
import type { SaleDeliveryMode } from "@auction/types";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import {
  accountBlockers,
  defaultGuestEntityId,
  guestDisplayName,
  hasNoBuyingEntity,
} from "./guest-helpers";

type CheckIn = { kind: "check-in"; guest: AdminExpectedGuestRow; assignPaddle: boolean };
type Reassign = { kind: "reassign"; guest: AdminExpectedGuestRow; registrationId: string };
type Step = CheckIn | Reassign;

function parseOptionalPaddle(text: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: null };
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < 100 || String(parsed) !== trimmed) {
    return { ok: false };
  }
  return { ok: true, value: parsed };
}

const PADDLE_ERROR = "Enter a paddle number of 100 or more, or leave it blank.";

/** Checks a guest in, or moves their paddle: the buying entity when there is a choice, then confirm. */
function GuestStepDialog({
  saleId,
  step,
  onClose,
}: {
  saleId: string;
  step: Step | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [entityId, setEntityId] = useState(() =>
    step?.kind === "check-in" ? defaultGuestEntityId(step.guest) : "",
  );
  const [paddle, setPaddle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [busy, startTransition] = useTransition();

  const guest = step?.guest;
  const name = guest ? guestDisplayName(guest) : "";
  const choosesPaddle =
    step?.kind === "reassign" || (step?.kind === "check-in" && step.assignPaddle);
  const entities = step?.kind === "check-in" ? (guest?.eligibleEntities ?? []) : [];

  const validate = (text: string) => (parseOptionalPaddle(text).ok ? null : PADDLE_ERROR);

  const submit = () => {
    if (!step) return;
    if (choosesPaddle) {
      const found = validate(paddle);
      setError(found);
      setAttempted(true);
      if (found) return;
    }
    const parsed = parseOptionalPaddle(paddle);
    const chosen = parsed.ok ? parsed.value : null;
    setFailure(null);
    startTransition(async () => {
      if (step.kind === "check-in") {
        const result = await adminSaleroomCheckInResultAction({
          saleId,
          userId: step.guest.userId,
          buyerLegalEntityId: entityId,
          assignPaddle: step.assignPaddle,
          ...(step.assignPaddle && chosen != null ? { paddleNumber: chosen } : {}),
        });
        if (!result.ok || !result.data) {
          setFailure(
            result.ok
              ? "Check-in failed."
              : saleroomCheckInErrorMessage(result.errorCode, result.error),
          );
          return;
        }
        if (step.assignPaddle && result.data.paddleNumber != null) {
          notify.success(`Paddle ${result.data.paddleNumber} assigned`, { description: name });
        } else {
          notify.success("Marked present", { description: name });
        }
      } else {
        const result = await adminAssignPaddleResultAction({
          saleId,
          registrationId: step.registrationId,
          ...(chosen != null ? { paddleNumber: chosen } : {}),
        });
        if (!result.ok || !result.data) {
          setFailure(
            result.ok
              ? "Paddle assignment failed."
              : saleroomCheckInErrorMessage(result.errorCode, result.error),
          );
          return;
        }
        notify.success(`Paddle ${result.data.paddleNumber} assigned`, { description: name });
      }
      onClose();
      router.refresh();
    });
  };

  const title = !step
    ? ""
    : step.kind === "reassign"
      ? `Reassign ${name}'s paddle`
      : step.assignPaddle
        ? `Assign a paddle to ${name}`
        : `Mark ${name} present`;

  return (
    <StaffDialog
      open={step !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={title}
      description={
        step?.kind === "check-in" && !step.assignPaddle
          ? "They are recorded as attending. A paddle can be given later."
          : "Leave the number blank to give the next free paddle."
      }
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton ref={cancelRef} variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </StaffButton>
          <StaffButton variant="primary" loading={busy} onClick={submit}>
            {step?.kind === "check-in" && !step.assignPaddle ? "Mark present" : "Assign paddle"}
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
        {entities.length > 1 ? (
          <Field label="Buying as" description="The entity this guest bids for in the room.">
            <EnumSelect
              value={entityId || null}
              onValueChange={setEntityId}
              options={entities.map((entity) => ({
                value: entity.id,
                label: entity.displayName,
              }))}
            />
          </Field>
        ) : null}
        {choosesPaddle ? (
          <Field
            label="Paddle number"
            description="A number of 100 or more that no one else holds."
            optional
            error={error}
            disabled={busy}
          >
            <TextInput
              inputMode="numeric"
              autoComplete="off"
              placeholder="Next free paddle"
              value={paddle}
              onChange={(event) => {
                setPaddle(event.target.value);
                if (attempted) setError(validate(event.target.value));
              }}
            />
          </Field>
        ) : null}
      </form>
    </StaffDialog>
  );
}

/**
 * What staff can do with an expected guest at the door, from the row's `…` menu: mark present,
 * give or move a paddle, clear it, or open the profile when something blocks check-in.
 */
export function useExpectedGuestActions(saleId: string, deliveryMode: SaleDeliveryMode) {
  const confirm = useStaffConfirm();
  const { ask } = confirm;
  const [step, setStep] = useState<Step | null>(null);
  const hybrid = deliveryMode === "hybrid";

  const actionsFor = useCallback(
    (guest: AdminExpectedGuestRow): OverflowAction[] => {
      const name = guestDisplayName(guest);
      const registration = guest.saleRegistration;
      const blockers = accountBlockers(guest);
      const blockedReason =
        blockers.length > 0
          ? "Resolve the account issues first"
          : hasNoBuyingEntity(guest)
            ? "Set the guest up at the desk first"
            : undefined;
      const gate = blockedReason ? { disabledReason: blockedReason } : {};
      const hasPaddle = registration?.paddleNumber != null;
      const present = registration?.checkedInAt != null;
      const actions: OverflowAction[] = [];

      if (!present && hybrid) {
        actions.push({
          id: "present",
          label: "Mark present",
          onSelect: () => setStep({ kind: "check-in", guest, assignPaddle: false }),
          ...gate,
        });
      }
      if (!hasPaddle) {
        actions.push({
          id: "paddle",
          label: hybrid ? "Give paddle" : "Assign paddle",
          onSelect: () => setStep({ kind: "check-in", guest, assignPaddle: true }),
          ...gate,
        });
      }
      if (hasPaddle && registration) {
        actions.push({
          id: "reassign",
          label: "Reassign paddle",
          onSelect: () =>
            setStep({ kind: "reassign", guest, registrationId: registration.registrationId }),
        });
        actions.push({
          id: "clear",
          label: "Clear paddle",
          tone: "danger",
          onSelect: () =>
            ask({
              title: `Clear ${name}'s paddle?`,
              description: `Paddle ${registration.paddleNumber} is released and can be given to someone else.`,
              confirmLabel: "Clear paddle",
              tone: "danger",
              run: async () => {
                const result = await adminClearPaddleResultAction({
                  saleId,
                  registrationId: registration.registrationId,
                });
                return result.ok ? { ok: true } : { ok: false, error: result.error };
              },
              success: "Paddle cleared",
            }),
        });
      }
      if (hasNoBuyingEntity(guest)) {
        actions.push({ id: "desk", label: "Open desk check-in", href: "#check-in" });
      }
      actions.push({
        id: "client",
        label: "Open client",
        href: `/admin/clients/${encodeURIComponent(guest.userId)}`,
      });
      return actions;
    },
    [ask, hybrid, saleId],
  );

  const dialogs = (
    <>
      {confirm.dialog}
      <GuestStepDialog
        key={step ? `${step.kind}-${step.guest.rsvpId}` : "closed"}
        saleId={saleId}
        step={step}
        onClose={() => setStep(null)}
      />
    </>
  );

  return { actionsFor, dialogs };
}
