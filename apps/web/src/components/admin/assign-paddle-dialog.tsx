"use client";

import { adminAssignPaddleResultAction } from "@/lib/actions/admin";
import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin-sale-registrations.types";
import { registrationBidderLabel } from "@/lib/data/view-models/sale-registrations-tab.vm";
import { saleroomCheckInErrorMessage } from "@/lib/saleroom/check-in-error-messages";
import { notify } from "@/lib/ui/notify";
import {
  Field,
  Notice,
  SegmentedControl,
  StaffButton,
  StaffDialog,
  TextInput,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

type Props = {
  saleId: string;
  row: AdminSaleRegistrationRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Mode = "auto" | "manual";

const MODES = [
  { value: "auto", label: "Next available" },
  { value: "manual", label: "Choose a number" },
] as const;

const MISSING_NUMBER = "Enter a paddle number of 100 or more.";

function parsePaddle(text: string): number | null {
  const parsed = Number.parseInt(text.trim(), 10);
  return Number.isInteger(parsed) && parsed >= 100 && String(parsed) === text.trim()
    ? parsed
    : null;
}

/** Gives an approved bidder an in-room paddle, the next free one or a number chosen at the desk. */
export function AssignPaddleDialog({ saleId, row, open, onOpenChange }: Props) {
  const router = useRouter();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<Mode>("auto");
  const [paddleNumber, setPaddleNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [busy, startTransition] = useTransition();

  const kycApproved = row.kycStatus === "approved";

  const close = () => {
    onOpenChange(false);
    setMode("auto");
    setPaddleNumber("");
    setError(null);
    setFailure(null);
    setAttempted(false);
  };

  const validate = (nextMode: Mode, text: string) =>
    nextMode === "manual" && parsePaddle(text) == null ? MISSING_NUMBER : null;

  const submit = () => {
    const found = validate(mode, paddleNumber);
    setError(found);
    setAttempted(true);
    if (found) return;
    setFailure(null);
    const chosen = mode === "manual" ? parsePaddle(paddleNumber) : null;
    startTransition(async () => {
      const result = await adminAssignPaddleResultAction({
        saleId,
        registrationId: row.id,
        ...(chosen != null ? { paddleNumber: chosen } : {}),
      });
      if (!result.ok || result.data == null) {
        setFailure(
          result.ok
            ? "Unexpected response from the server."
            : saleroomCheckInErrorMessage(result.errorCode, result.error),
        );
        return;
      }
      notify.success(`Paddle ${result.data.paddleNumber} assigned`, {
        description: registrationBidderLabel(row),
      });
      close();
      router.refresh();
    });
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) close();
      }}
      title="Assign a paddle"
      description={`Give ${registrationBidderLabel(row)} an in-room paddle.`}
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton ref={cancelRef} variant="secondary" disabled={busy} onClick={close}>
            Cancel
          </StaffButton>
          <StaffButton
            variant="primary"
            loading={busy}
            {...(kycApproved ? {} : { disabledReason: "Identity check must be complete first" })}
            onClick={submit}
          >
            Assign paddle
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
        {kycApproved ? null : (
          <Notice tone="warning" title="Identity check not complete">
            A paddle can be assigned once the bidder has passed their identity check.
          </Notice>
        )}
        <SegmentedControl<Mode>
          label="How to choose the paddle"
          value={mode}
          onValueChange={(next) => {
            setMode(next);
            if (attempted) setError(validate(next, paddleNumber));
          }}
          options={MODES}
        />
        {mode === "auto" ? (
          <p className="text-staff-sm text-staff-muted">
            The next free paddle number, from 100 upwards, is assigned automatically.
          </p>
        ) : (
          <Field
            label="Paddle number"
            description="A number of 100 or more that no one else holds."
            error={error}
            disabled={busy}
          >
            <TextInput
              inputMode="numeric"
              autoComplete="off"
              value={paddleNumber}
              onChange={(event) => {
                setPaddleNumber(event.target.value);
                if (attempted) setError(validate(mode, event.target.value));
              }}
            />
          </Field>
        )}
      </form>
    </StaffDialog>
  );
}
