"use client";

import {
  setOrgTwoFactorPolicyAction,
  setStaffTwoFactorPolicyAction,
} from "@/lib/security/two-factor-policy.actions";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import { Switch } from "@auction/ui/components/switch";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

export type TwoFactorPolicyScope = { kind: "staff" } | { kind: "org"; legalEntityId: string };

type Props = {
  scope: TwoFactorPolicyScope;
  required: boolean;
  members: number;
  enrolled: number;
  canEdit: boolean;
};

const COPY = {
  staff: {
    title: "Require two-step verification for all LAX staff",
    audience: "staff",
    readOnly: "Only a super admin can change this.",
  },
  org: {
    title: "Require two-step verification for members",
    audience: "members",
    readOnly: "Only the organisation owner can change this.",
  },
} as const;

export function TwoFactorPolicyCard({ scope, required, members, enrolled, canEdit }: Props) {
  const router = useRouter();
  const switchId = useId();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[scope.kind];
  const notEnrolled = Math.max(members - enrolled, 0);

  function save(next: boolean) {
    setError(null);
    startTransition(async () => {
      const result =
        scope.kind === "staff"
          ? await setStaffTwoFactorPolicyAction(next)
          : await setOrgTwoFactorPolicyAction(scope.legalEntityId, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Surface variant="section" padding="md" className="space-y-4">
      <div className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <label
            htmlFor={switchId}
            className="font-headline text-base font-semibold text-on-surface"
          >
            {copy.title}
          </label>
          <p className="font-body text-sm text-on-surface-variant">
            When on, {copy.audience} must use an authenticator app or sign in with Google or Apple.
            Anyone not yet set up is asked to add an authenticator at their next sign-in.
          </p>
        </div>
        <Switch
          id={switchId}
          checked={required}
          disabled={!canEdit || pending}
          onCheckedChange={(next) => setConfirming(next)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 font-body text-sm text-on-surface-variant">
        <StatusBadge variant={required ? "success" : "neutral"}>
          {required ? "Required" : "Optional"}
        </StatusBadge>
        <span>
          {enrolled} of {members} {copy.audience} have two-step verification on
          {notEnrolled > 0 ? ` · ${notEnrolled} not set up` : ""}.
        </span>
      </div>
      {!canEdit ? (
        <p className="font-body text-xs text-on-surface-variant">{copy.readOnly}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {confirming !== null ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirming(null);
          }}
          title={
            confirming ? "Require two-step verification?" : "Make two-step verification optional?"
          }
          body={
            confirming
              ? notEnrolled > 0
                ? `${notEnrolled} ${copy.audience} without an authenticator will be asked to set one up at their next sign-in. Nobody is signed out now.`
                : `All ${copy.audience} already use two-step verification. New ${copy.audience} will be asked to set it up at their first sign-in.`
              : `${copy.audience[0]?.toUpperCase()}${copy.audience.slice(1)} will be able to turn two-step verification off in their own security settings.`
          }
          confirmLabel={confirming ? "Require it" : "Make optional"}
          tone={confirming ? "info" : "warning"}
          loading={pending}
          onConfirm={() => {
            const next = confirming;
            setConfirming(null);
            save(next);
          }}
        />
      ) : null}
    </Surface>
  );
}
