"use client";

import { adminAssignPaddleResultAction, adminClearPaddleResultAction } from "@/lib/actions/admin";
import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin.server";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  saleId: string;
  row: AdminSaleRegistrationRow;
};

export function PaddleCheckInControls({ saleId, row }: Props) {
  const router = useRouter();
  const [paddleNumber, setPaddleNumber] = useState(
    row.paddleNumber != null ? String(row.paddleNumber) : "",
  );
  const [pending, startTransition] = useTransition();

  if (row.status !== "approved") return null;

  const kycApproved = row.kycStatus === "approved";

  const onAssign = () => {
    if (!kycApproved) {
      notify.error("Complete identity verification before assigning a paddle");
      return;
    }
    startTransition(async () => {
      const parsed = paddleNumber.trim() === "" ? undefined : Number.parseInt(paddleNumber, 10);
      if (parsed != null && (!Number.isInteger(parsed) || parsed < 100)) {
        notify.error("Paddle number must be at least 100");
        return;
      }
      const result = await adminAssignPaddleResultAction({
        saleId,
        registrationId: row.id,
        ...(parsed != null ? { paddleNumber: parsed } : {}),
      });
      if (!result.ok || result.data == null) {
        notify.error(result.ok ? "Unexpected response" : result.error);
        return;
      }
      notify.success(`Paddle ${result.data.paddleNumber} assigned`);
      router.refresh();
    });
  };

  const onClear = () => {
    startTransition(async () => {
      const result = await adminClearPaddleResultAction({
        saleId,
        registrationId: row.id,
      });
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      notify.success("Paddle cleared");
      setPaddleNumber("");
      router.refresh();
    });
  };

  return (
    <div className="mt-3 space-y-2 border-t border-border-hairline pt-3">
      <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        In-room check-in
      </p>
      {row.paddleNumber != null ? (
        <p className="font-body text-sm text-foreground">
          Paddle <span className="font-semibold tabular-nums">{row.paddleNumber}</span>
        </p>
      ) : null}
      {!kycApproved ? (
        <p className="font-body text-xs text-error">KYC must pass before paddle assignment.</p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`paddle-${row.id}`}>Paddle #</Label>
          <Input
            id={`paddle-${row.id}`}
            value={paddleNumber}
            onChange={(e) => setPaddleNumber(e.target.value)}
            placeholder="Auto (≥100)"
            className="w-28 font-body text-sm tabular-nums"
            disabled={pending}
          />
        </div>
        <Button type="button" size="sm" disabled={pending || !kycApproved} onClick={onAssign}>
          {row.paddleNumber != null ? "Reassign" : "Assign"}
        </Button>
        {row.paddleNumber != null ? (
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
