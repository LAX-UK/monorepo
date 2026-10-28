"use client";

import { setStaffTwoFactorPolicyAction } from "@/lib/security/two-factor-policy.actions";
import { notify } from "@/lib/ui/notify";
import {
  ChoiceRow,
  ConfirmActionDialog,
  KeyValueList,
  Notice,
  Section,
  StaffSwitch,
  StatusBadge,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const COUNT = new Intl.NumberFormat("en-GB");

/**
 * Whether every LAX staff member must use two-step verification. The switch takes effect at once
 * after a confirm that says who is affected; the coverage below it shows how many already have it
 * on. A failure stays in the section.
 */
export function StaffTwoFactorPolicy({
  required,
  members,
  enrolled,
  canEdit,
}: {
  required: boolean;
  members: number;
  enrolled: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();
  const notEnrolled = Math.max(members - enrolled, 0);

  const save = (next: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await setStaffTwoFactorPolicyAction(next);
      setAsking(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      notify.success(
        next ? "Two-step verification is now required" : "Two-step verification is now optional",
      );
      router.refresh();
    });
  };

  return (
    <Section
      title="Two-step verification"
      description="Applies to everyone with a staff role in Bid admin and LAX Admin."
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <Notice tone="danger" alert title="The policy did not change">
            {error}
          </Notice>
        ) : null}
        <ChoiceRow
          htmlFor="staff-two-factor"
          disabled={!canEdit}
          label="Require two-step verification for all staff"
          description={`Staff then sign in with an authenticator app, Google or Apple. Anyone not set up is asked to add an authenticator at their next sign-in.${canEdit ? "" : " Only an administrator can change this."}`}
          control={
            <StaffSwitch
              id="staff-two-factor"
              checked={required}
              disabled={!canEdit || saving}
              onCheckedChange={(next) => setAsking(next)}
            />
          }
        />
        <KeyValueList
          items={[
            {
              label: "Policy",
              value: (
                <StatusBadge tone={required ? "success" : "neutral"}>
                  {required ? "Required" : "Optional"}
                </StatusBadge>
              ),
            },
            {
              label: "Staff with it on",
              value: `${COUNT.format(enrolled)} of ${COUNT.format(members)}`,
              numeric: true,
            },
            ...(notEnrolled > 0
              ? [{ label: "Not set up yet", value: COUNT.format(notEnrolled), numeric: true }]
              : []),
          ]}
        />
      </div>
      <ConfirmActionDialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setAsking(null);
        }}
        title={
          asking
            ? "Require two-step verification for all staff?"
            : "Make two-step verification optional?"
        }
        description={
          asking
            ? notEnrolled > 0
              ? `${COUNT.format(notEnrolled)} staff without an authenticator will be asked to set one up at their next sign-in. Nobody is signed out now.`
              : "Every staff member already uses it. New staff are asked to set it up at their first sign-in."
            : "Staff will be able to turn two-step verification off in their own security settings."
        }
        confirmLabel={asking ? "Require it" : "Make it optional"}
        tone={asking ? "default" : "danger"}
        loading={saving}
        onConfirm={() => {
          if (asking !== null) save(asking);
        }}
      />
    </Section>
  );
}
