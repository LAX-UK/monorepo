"use client";

import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { cn } from "@auction/ui";
import { Hourglass, ShieldAlert, ShieldCheck } from "lucide-react";
import { KYC_VERIFY_DESCRIPTION, type KycUiPhase, kycStatusHint, kycStatusLabel } from "./kyc-copy";

type Props = {
  summary: KycStatusSummaryDto | null;
  phase?: KycUiPhase;
  className?: string;
};

export function KycStatusPanel({ summary, phase = "idle", className }: Props) {
  const status = summary?.status ?? "unverified";
  const requiresKyc = summary?.requiresKyc ?? false;
  const label = kycStatusLabel(status, requiresKyc);
  const hint = kycStatusHint(status, phase);

  const Icon =
    status === "approved"
      ? ShieldCheck
      : status === "rejected"
        ? ShieldAlert
        : phase === "submitted" || status === "pending"
          ? Hourglass
          : ShieldAlert;

  const tone =
    status === "approved"
      ? "border-emerald-500/30 bg-emerald-500/5 text-on-surface"
      : status === "rejected"
        ? "border-live-red/30 bg-live-red/5 text-on-surface"
        : requiresKyc || phase === "submitted"
          ? "border-lot-orange/30 bg-lot-orange/5 text-on-surface"
          : "border-outline-variant/30 bg-surface-container-low text-on-surface";

  return (
    <div
      className={cn("rounded-xl border p-4", tone, className)}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 opacity-80" aria-hidden />
        <div className="space-y-1">
          <p className="font-headline text-sm font-semibold">{label}</p>
          <p className="text-sm text-on-surface-variant">{hint}</p>
          {status === "unverified" && phase === "idle" ? (
            <p className="text-sm text-on-surface-variant">{KYC_VERIFY_DESCRIPTION}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
