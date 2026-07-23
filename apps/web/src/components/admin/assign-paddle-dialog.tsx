"use client";

import { adminAssignPaddleResultAction } from "@/lib/actions/admin";
import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin-sale-registrations.types";
import { registrationBidderLabel } from "@/lib/data/view-models/sale-registrations-tab.vm";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  saleId: string;
  row: AdminSaleRegistrationRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AssignPaddleDialog({ saleId, row, open, onOpenChange }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [paddleNumber, setPaddleNumber] = useState("");
  const [pending, startTransition] = useTransition();

  const bidderLabel = registrationBidderLabel(row);
  const kycApproved = row.kycStatus === "approved";

  const reset = () => {
    setMode("auto");
    setPaddleNumber("");
  };

  const onOpenChangeWrapped = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const assign = (parsed?: number) => {
    if (!kycApproved) {
      notify.error("Complete identity verification before assigning a paddle");
      return;
    }
    startTransition(async () => {
      const result = await adminAssignPaddleResultAction({
        saleId,
        registrationId: row.id,
        ...(parsed != null ? { paddleNumber: parsed } : {}),
      });
      if (!result.ok || result.data == null) {
        notify.error(result.ok ? "Unexpected response" : result.error);
        return;
      }
      notify.success(`Paddle ${result.data.paddleNumber} assigned`, {
        description: "Return to the clerk console to place in-room bids.",
      });
      onOpenChangeWrapped(false);
      router.refresh();
    });
  };

  const onAssignAuto = () => assign();

  const onAssignManual = () => {
    const parsed = Number.parseInt(paddleNumber.trim(), 10);
    if (!Number.isInteger(parsed) || parsed < 100) {
      notify.error("Paddle number must be at least 100");
      return;
    }
    assign(parsed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChangeWrapped}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign paddle</DialogTitle>
          <DialogDescription>
            Assign an in-room paddle to{" "}
            <span className="font-medium text-on-surface">{bidderLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        {!kycApproved ? (
          <p className="font-body text-sm text-error">KYC must pass before paddle assignment.</p>
        ) : null}

        <div
          className="inline-flex rounded-full border border-shell-stroke p-1"
          role="tablist"
          aria-label="Paddle assignment mode"
        >
          {(
            [
              ["auto", "Auto-assign"],
              ["manual", "Manual number"],
            ] as const
          ).map(([id, label]) => {
            const active = mode === id;
            return (
              <Button
                key={id}
                type="button"
                variant="ghost"
                role="tab"
                aria-selected={active}
                disabled={pending}
                onClick={() => setMode(id)}
                className={
                  active
                    ? "rounded-full bg-secondary px-4 py-1.5 font-label text-xs font-medium text-on-secondary"
                    : "rounded-full px-4 py-1.5 font-label text-xs font-medium text-on-surface-variant hover:text-on-surface"
                }
              >
                {label}
              </Button>
            );
          })}
        </div>

        {mode === "auto" ? (
          <p className="font-body text-sm text-on-surface-variant">
            The next available paddle number (≥100) will be assigned automatically.
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={`assign-paddle-${row.id}`}>Paddle number</Label>
            <Input
              id={`assign-paddle-${row.id}`}
              value={paddleNumber}
              onChange={(e) => setPaddleNumber(e.target.value)}
              placeholder="e.g. 142"
              className="font-body text-sm tabular-nums"
              disabled={pending}
            />
            <p className="font-body text-xs text-on-surface-variant">Must be at least 100.</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChangeWrapped(false)}
          >
            Cancel
          </Button>
          {mode === "auto" ? (
            <Button
              type="button"
              variant="primary"
              disabled={pending || !kycApproved}
              onClick={onAssignAuto}
            >
              Assign paddle
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              disabled={pending || !kycApproved}
              onClick={onAssignManual}
            >
              Assign paddle
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
