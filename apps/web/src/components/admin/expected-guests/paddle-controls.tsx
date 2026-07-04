"use client";

import { adminAssignPaddleResultAction, adminClearPaddleResultAction } from "@/lib/actions/admin";
import type { AdminExpectedGuestRow } from "@/lib/data/http/admin-expected-guests.server";
import { saleroomCheckInErrorMessage } from "@/lib/saleroom/check-in-error-messages";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { useState, useTransition } from "react";
import { guestDisplayName } from "./guest-helpers";

export function PaddleControls({
  saleId,
  guest,
  registrationId,
  onDone,
}: {
  saleId: string;
  guest: AdminExpectedGuestRow;
  registrationId: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showReassign, setShowReassign] = useState(false);
  const [paddleInput, setPaddleInput] = useState("");

  const runReassign = () => {
    setError(null);
    const trimmed = paddleInput.trim();
    if (trimmed !== "") {
      const paddleN = Number.parseInt(trimmed, 10);
      if (!Number.isInteger(paddleN) || paddleN < 100) {
        setError(saleroomCheckInErrorMessage("invalid_paddle", "Invalid paddle number"));
        return;
      }
    }
    startTransition(async () => {
      const result = await adminAssignPaddleResultAction({
        saleId,
        registrationId,
        ...(trimmed !== "" ? { paddleNumber: Number.parseInt(trimmed, 10) } : {}),
      });
      if (!result.ok || !result.data) {
        setError(
          saleroomCheckInErrorMessage(
            result.ok === false ? result.errorCode : undefined,
            result.ok === false ? result.error : "Reassign failed",
          ),
        );
        return;
      }
      notify.success(`Paddle ${result.data.paddleNumber} assigned`, {
        description: guestDisplayName(guest),
      });
      setShowReassign(false);
      setPaddleInput("");
      onDone();
    });
  };

  const runClear = () => {
    setError(null);
    startTransition(async () => {
      const result = await adminClearPaddleResultAction({ saleId, registrationId });
      if (!result.ok) {
        setError(result.error ?? "Clear paddle failed");
        return;
      }
      notify.success("Paddle cleared", { description: guestDisplayName(guest) });
      onDone();
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setShowReassign((open) => !open)}
        >
          Reassign
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={runClear}>
          Clear
        </Button>
      </div>
      {showReassign ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={paddleInput}
            onChange={(e) => setPaddleInput(e.target.value)}
            placeholder="Auto-assign or enter #"
            className="h-8 w-36 font-body text-xs tabular-nums"
            aria-label="Paddle number for reassignment"
          />
          <Button type="button" size="sm" disabled={pending} onClick={runReassign}>
            Confirm
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="font-body text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
