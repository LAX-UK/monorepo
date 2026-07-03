"use client";

import type { AdminCheckInCandidate } from "@/lib/data/http/admin.server";
import {
  BID_LIMIT_FIELD_LABEL,
  bidLimitFieldHelp,
  bidLimitFieldPlaceholder,
} from "@/lib/saleroom/bid-limit-field-copy";
import { formatMoney } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import Link from "next/link";

type Props = {
  candidate: AdminCheckInCandidate;
  saleCurrency: string;
  isHybrid: boolean;
  entityId: string;
  onEntityIdChange: (id: string) => void;
  bidLimit: string;
  onBidLimitChange: (value: string) => void;
  paddleNumber: string;
  onPaddleNumberChange: (value: string) => void;
  submitError: string | null;
  pending: boolean;
  onCheckIn: (assignPaddle: boolean) => void;
};

export function SaleroomCheckInForm({
  candidate,
  saleCurrency,
  isHybrid,
  entityId,
  onEntityIdChange,
  bidLimit,
  onBidLimitChange,
  paddleNumber,
  onPaddleNumberChange,
  submitError,
  pending,
  onCheckIn,
}: Props) {
  const eligibleEntities = candidate.eligibleEntities ?? [];
  const prerequisitesOk =
    !candidate.suspended &&
    candidate.kycStatus === "approved" &&
    candidate.emailVerified &&
    entityId.length > 0;

  const blockerMessages: string[] = [];
  if (candidate.suspended) blockerMessages.push("Account is suspended.");
  if (candidate.kycStatus !== "approved") {
    blockerMessages.push("Identity verification is not complete.");
  }
  if (!candidate.emailVerified) blockerMessages.push("Email address is not verified.");

  const selectedEntity = eligibleEntities.find((e) => e.id === entityId);
  const existingLimit = selectedEntity?.existingRegistration?.bidLimit;

  return (
    <div className="space-y-3 rounded-md border border-border-hairline p-4">
      {blockerMessages.length > 0 ? (
        <ul className="space-y-1" role="alert">
          {blockerMessages.map((msg) => (
            <li key={msg} className="font-body text-xs text-destructive">
              {msg}
            </li>
          ))}
          <li>
            <Link
              href={`/admin/clients/${candidate.userId}`}
              className="font-body text-xs text-link underline"
            >
              Open client profile
            </Link>
          </li>
        </ul>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="check-in-entity">Buying as</Label>
        <Select
          value={entityId}
          onValueChange={(id) => {
            onEntityIdChange(id);
            const ent = eligibleEntities.find((e) => e.id === id);
            const limit = ent?.existingRegistration?.bidLimit;
            onBidLimitChange(limit?.replace(/\.00$/, "") ?? "");
          }}
        >
          <SelectTrigger id="check-in-entity" className="font-body text-sm">
            <SelectValue placeholder="Select entity…" />
          </SelectTrigger>
          <SelectContent>
            {eligibleEntities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.displayName} ({e.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="check-in-bid-limit">{BID_LIMIT_FIELD_LABEL}</Label>
          <Input
            id="check-in-bid-limit"
            type="number"
            min={0}
            step="0.01"
            value={bidLimit}
            onChange={(e) => onBidLimitChange(e.target.value)}
            placeholder={bidLimitFieldPlaceholder(saleCurrency)}
            className="font-body text-sm"
          />
          <p className="font-body text-xs text-on-surface-variant">
            {bidLimitFieldHelp(saleCurrency)}
          </p>
          {existingLimit && bidLimit.trim() === "" ? (
            <p className="font-body text-xs text-secondary">
              Current limit: {formatMoney(existingLimit, saleCurrency)}
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <Label htmlFor="check-in-paddle">Paddle number</Label>
          <Input
            id="check-in-paddle"
            value={paddleNumber}
            onChange={(e) => onPaddleNumberChange(e.target.value)}
            placeholder="Leave blank to auto-assign"
            className="font-body text-sm tabular-nums"
          />
        </div>
      </div>

      {submitError ? (
        <p className="font-body text-xs text-destructive" role="alert" aria-live="polite">
          {submitError}
        </p>
      ) : null}

      {isHybrid ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!prerequisitesOk || pending}
            onClick={() => onCheckIn(false)}
            className="min-h-10"
          >
            {pending ? "Checking in…" : "Mark present"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!prerequisitesOk || pending}
            onClick={() => onCheckIn(true)}
            className="min-h-10"
          >
            {pending ? "Checking in…" : "Give paddle"}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          disabled={!prerequisitesOk || pending}
          onClick={() => onCheckIn(true)}
          className="min-h-10"
        >
          {pending ? "Checking in…" : "Check in and assign paddle"}
        </Button>
      )}
    </div>
  );
}
