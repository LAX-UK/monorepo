"use client";

import type { AdminCheckInCandidate } from "@/lib/data/http/admin.server";
import { decimalToMinorUnits } from "@/lib/data/view-models/client-commerce-tab.vm";
import { bidLimitFieldHelp } from "@/lib/saleroom/bid-limit-field-copy";
import {
  EnumSelect,
  Field,
  Notice,
  StaffButton,
  StaffMoney,
  TextInput,
  humanizeStatus,
} from "@auction/staff-ui";
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

/** The chosen client's details for check-in: buying entity, optional bid cap and paddle. */
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
  if (candidate.suspended) blockerMessages.push("The account is suspended.");
  if (candidate.kycStatus !== "approved") {
    blockerMessages.push("Identity verification is not complete.");
  }
  if (!candidate.emailVerified) blockerMessages.push("The email address is not verified.");

  const selectedEntity = eligibleEntities.find((e) => e.id === entityId);
  const existingLimit = selectedEntity?.existingRegistration?.bidLimit;
  const blockedReason = prerequisitesOk ? undefined : "Resolve the account issues first";

  return (
    <div className="flex flex-col gap-4 rounded-staff-lg border border-staff-line bg-staff-sunken p-4">
      {blockerMessages.length > 0 ? (
        <Notice
          tone="danger"
          alert
          title="This client cannot be checked in yet"
          actions={
            <Link
              href={`/admin/clients/${encodeURIComponent(candidate.userId)}`}
              className="text-staff-sm font-medium underline underline-offset-2"
            >
              Open client
            </Link>
          }
        >
          {blockerMessages.join(" ")}
        </Notice>
      ) : null}

      <Field label="Buying as" disabled={pending}>
        <EnumSelect
          value={entityId || null}
          onValueChange={(id) => {
            onEntityIdChange(id);
            const entity = eligibleEntities.find((e) => e.id === id);
            const limit = entity?.existingRegistration?.bidLimit;
            onBidLimitChange(limit?.replace(/\.00$/, "") ?? "");
          }}
          options={eligibleEntities.map((entity) => ({
            value: entity.id,
            label: `${entity.displayName} (${humanizeStatus(entity.role)})`,
          }))}
          placeholder="Choose an entity"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Maximum hammer"
          description={bidLimitFieldHelp(saleCurrency)}
          optional
          disabled={pending}
        >
          <TextInput
            inputMode="decimal"
            autoComplete="off"
            leading={<span className="text-staff-muted">{saleCurrency}</span>}
            value={bidLimit}
            onChange={(event) => onBidLimitChange(event.target.value)}
            placeholder="e.g. 50,000"
            className="tabular-nums"
          />
          {existingLimit && bidLimit.trim() === "" ? (
            <p className="mt-1.5 text-staff-xs text-staff-muted">
              Current limit:{" "}
              <StaffMoney minor={decimalToMinorUnits(existingLimit)} currency={saleCurrency} />
            </p>
          ) : null}
        </Field>
        <Field
          label="Paddle number"
          description="Leave blank to give the next free paddle."
          optional
          disabled={pending}
        >
          <TextInput
            inputMode="numeric"
            autoComplete="off"
            value={paddleNumber}
            onChange={(event) => onPaddleNumberChange(event.target.value)}
            className="tabular-nums"
          />
        </Field>
      </div>

      {submitError ? (
        <Notice tone="danger" alert title="Check-in did not go through">
          {submitError}
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isHybrid ? (
          <>
            <StaffButton
              variant="primary"
              loading={pending}
              {...(blockedReason ? { disabledReason: blockedReason } : {})}
              onClick={() => onCheckIn(false)}
            >
              Mark present
            </StaffButton>
            <StaffButton
              variant="secondary"
              loading={pending}
              {...(blockedReason ? { disabledReason: blockedReason } : {})}
              onClick={() => onCheckIn(true)}
            >
              Give paddle
            </StaffButton>
          </>
        ) : (
          <StaffButton
            variant="primary"
            loading={pending}
            {...(blockedReason ? { disabledReason: blockedReason } : {})}
            onClick={() => onCheckIn(true)}
          >
            Check in and assign paddle
          </StaffButton>
        )}
      </div>
    </div>
  );
}
