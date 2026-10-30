"use client";

import type { LeaveControl } from "@/lib/legal-entity/member-controls.vm";
import { Button } from "@auction/ui/lax";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { LeaveOrganisationDialog } from "./leave-organisation-dialog";
import { SettingsCard } from "./settings-section";

/** A row whose title leads: what the action is, then what it means or why it can't be done. */
function ActionRow({ label, value, action }: { label: string; value: string; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 md:px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-lax-14 font-medium text-lax-fg">{label}</p>
        <p className="text-lax-13 text-lax-muted">{value}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

type Props = {
  legalEntityId: string;
  organisationName: string;
  leave: LeaveControl;
  /** Owners close the organisation, through LAX, once open invoices and payouts are settled. */
  canClose: boolean;
};

/**
 * Leaving, for any member (the last owner is told to hand ownership on first), and closing the
 * organisation, which goes through LAX so open invoices and payouts are settled first.
 */
export function LeaveOrCloseCard({ legalEntityId, organisationName, leave, canClose }: Props) {
  const [leaving, setLeaving] = useState(false);
  return (
    <>
      <SettingsCard>
        <ActionRow
          label={`Leave ${organisationName}`}
          value={
            leave.allowed
              ? "You'll lose access straight away. Bids you've placed stand."
              : leave.reason
          }
          action={
            <Button
              variant="danger-secondary"
              disabled={!leave.allowed}
              onClick={() => setLeaving(true)}
            >
              Leave
            </Button>
          }
        />
        {canClose ? (
          <ActionRow
            label={`Close ${organisationName}`}
            value="We'll settle open invoices and payouts with you first."
            action={
              <Button asChild variant="ghost">
                <Link href="/contact">Contact us to close</Link>
              </Button>
            }
          />
        ) : null}
      </SettingsCard>
      {leaving ? (
        <LeaveOrganisationDialog
          legalEntityId={legalEntityId}
          organisationName={organisationName}
          onClose={() => setLeaving(false)}
        />
      ) : null}
    </>
  );
}
