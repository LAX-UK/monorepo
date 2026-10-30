"use client";

import { MemberInitials } from "@/components/legal-entity/members/member-initials";
import { initials } from "@/components/organisations/initials";
import type { AccessRequestRowView } from "@/lib/organisation-team/access-requests.vm";
import { decideAccessRequestAction } from "@/lib/organisation-team/organisation-team.actions";
import { notify } from "@/lib/ui/notify";
import type { LegalEntityMemberRole } from "@auction/types";
import { RecordList, RecordRow } from "@auction/ui";
import { Button, Dialog, Field, SelectMenu } from "@auction/ui/lax";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  legalEntityId: string;
  rows: readonly AccessRequestRowView[];
};

type Choosing = { row: AccessRequestRowView; role: LegalEntityMemberRole };

/**
 * Requests for more access waiting on an owner or admin: who asks, for what and why. Approve
 * gives the role at once (a request for one ability asks which role to give first); Decline
 * says no. Either way the member is told, and the decision is kept in Activity.
 */
export function AccessRequestsPanel({ legalEntityId, rows }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [choosing, setChoosing] = useState<Choosing | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (
    row: AccessRequestRowView,
    decision: { kind: "approve"; role?: LegalEntityMemberRole } | { kind: "decline" },
  ) => {
    setBusy(row.id);
    startTransition(async () => {
      const result = await decideAccessRequestAction(legalEntityId, row.id, decision);
      setBusy(null);
      if (!result.ok) {
        setErrors((map) => ({ ...map, [row.id]: result.error }));
        return;
      }
      setChoosing(null);
      notify.success(
        decision.kind === "approve"
          ? `${row.requesterName}'s access is updated`
          : `${row.requesterName}'s request is declined`,
        { description: "We've let them know." },
      );
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="access-requests-heading" className="flex flex-col gap-3">
      <h2
        id="access-requests-heading"
        className="font-lax-display text-lax-18 font-semibold text-lax-fg"
      >
        Asking for access
      </h2>
      <RecordList aria-labelledby="access-requests-heading">
        {rows.map((row) => (
          <RecordRow
            key={row.id}
            leading={<MemberInitials>{initials(row.requesterName)}</MemberInitials>}
            title={`${row.requesterName} · ${row.ask}`}
            meta={[`“${row.reason}”`, row.when]}
            action={
              row.isOwn ? (
                <span className="text-lax-13 text-lax-muted">Another owner or admin decides</span>
              ) : (
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => decide(row, { kind: "decline" })}
                    {...(busy === row.id && pending ? { "aria-busy": true } : {})}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => {
                      const first = row.roleChoices[0]?.value;
                      if (row.role) decide(row, { kind: "approve" });
                      else if (first) setChoosing({ row, role: first });
                    }}
                  >
                    Approve
                  </Button>
                </span>
              )
            }
            detail={
              errors[row.id] ? (
                <p role="alert" className="text-lax-12 font-medium text-lax-danger">
                  {errors[row.id]}
                </p>
              ) : null
            }
          />
        ))}
      </RecordList>

      {choosing ? (
        <Dialog
          open
          onOpenChange={(next) => (next || pending ? undefined : setChoosing(null))}
          title={`Give ${choosing.row.requesterName} more access`}
          description={`“${choosing.row.reason}”`}
          footer={
            <>
              <Button disabled={pending} onClick={() => setChoosing(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={pending}
                onClick={() => decide(choosing.row, { kind: "approve", role: choosing.role })}
              >
                Approve
              </Button>
            </>
          }
        >
          <Field
            label="Their new role"
            description="Only roles that include what they asked for are listed."
          >
            <SelectMenu
              label="Their new role"
              value={choosing.role}
              onValueChange={(role) => setChoosing({ ...choosing, role })}
              options={choosing.row.roleChoices}
              className="w-full"
            />
          </Field>
        </Dialog>
      ) : null}
    </section>
  );
}
