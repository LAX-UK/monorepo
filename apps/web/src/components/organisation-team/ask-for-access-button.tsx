"use client";

import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { roleChangeConsequence } from "@/lib/organisation-team/access-requests.vm";
import {
  askForAccessAction,
  withdrawAccessRequestAction,
} from "@/lib/organisation-team/organisation-team.actions";
import {
  organisationRoleDescription,
  organisationRoleLabel,
} from "@/lib/presenters/organisation-role/organisation-role-presentation";
import { notify } from "@/lib/ui/notify";
import type { LegalEntityMemberRole } from "@auction/types";
import { Button, Dialog, DialogClose, Field, Notice, PresetCards, TextArea } from "@auction/ui/lax";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  legalEntityId: string;
  /** The tab the person could not open: "Payouts". */
  page: string;
  /** Roles that open it, least access first; empty hides "Ask for access". */
  roles: readonly LegalEntityMemberRole[];
  /** The request already waiting, if any. */
  waiting: { id: string; role: LegalEntityMemberRole | null } | null;
  /** The member's role now: an approval replaces it, and the dialog says what that costs. */
  currentRole: LegalEntityMemberRole;
};

const REASON_MIN = 3;

/**
 * The actions on a tab the person cannot open: "Ask for access" (a role, and why, sent to the
 * owners and admins), or the request already sent with a way to withdraw it; and Back to Home.
 */
export function NoAccessActions({ legalEntityId, page, roles, waiting, currentRole }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<LegalEntityMemberRole | undefined>(roles[0]);
  // A member holds one role: asking for another replaces it, so say what that costs first.
  const consequence = role ? roleChangeConsequence(currentRole, role) : null;
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reasonProblem =
    reason.trim().length < REASON_MIN ? "Say in a few words what you need it for." : null;

  const send = () => {
    setTried(true);
    if (!role || reasonProblem) return;
    startTransition(async () => {
      const result = await askForAccessAction(legalEntityId, { role, reason: reason.trim() });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      notify.success("Request sent", {
        description: "An owner or admin will decide, and we'll email you when they do.",
      });
      router.refresh();
    });
  };

  const withdraw = (id: string) =>
    startTransition(async () => {
      const result = await withdrawAccessRequestAction(legalEntityId, id);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      notify.success("Request withdrawn");
      router.refresh();
    });

  const back = (
    <Button asChild>
      <Link href={CLIENT_ROUTES.home}>Back to Home</Link>
    </Button>
  );

  if (waiting) {
    return (
      <>
        {/* "Request sent", with what was asked for, on one line however narrow the row. */}
        <output className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-lax-14 font-medium text-lax-fg">
          <Check aria-hidden className="size-4 text-lax-success-fg" />
          Request sent
          <span className="font-normal text-lax-muted">
            {waiting.role ? `· ${organisationRoleLabel(waiting.role)}` : "· more access"}
          </span>
        </output>
        <Button loading={pending} onClick={() => withdraw(waiting.id)}>
          Withdraw request
        </Button>
        {back}
      </>
    );
  }
  if (!role) return back;

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Ask for access
      </Button>
      {back}
      <Dialog
        open={open}
        onOpenChange={(next) => (pending ? undefined : setOpen(next))}
        title={`Ask for access to ${page}`}
        description="Your request goes to the owners and admins. They'll see why you need it."
        footer={
          <>
            <DialogClose asChild>
              <Button disabled={pending}>Cancel</Button>
            </DialogClose>
            <Button variant="primary" loading={pending} onClick={send}>
              Send request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {roles.length > 1 ? (
            <fieldset className="flex flex-col" disabled={pending}>
              <legend className="mb-1.5 text-lax-ui font-medium text-lax-fg">Role</legend>
              <PresetCards
                label="Role"
                columns={1}
                compact
                value={role}
                onValueChange={setRole}
                options={roles.map((value) => ({
                  value,
                  label: organisationRoleLabel(value),
                  description: organisationRoleDescription(value),
                }))}
              />
            </fieldset>
          ) : (
            <p className="text-lax-14 text-lax-muted">
              You&apos;re asking to be{" "}
              <span className="font-medium text-lax-fg">{organisationRoleLabel(role)}</span>.{" "}
              {organisationRoleDescription(role)}
            </p>
          )}
          {consequence ? (
            consequence.lost.length > 0 ? (
              <Notice tone="warning" title={consequence.sentence} />
            ) : (
              <p className="text-lax-13 text-lax-muted">{consequence.sentence}</p>
            )
          ) : null}
          <Field label="Why you need it" error={(tried ? reasonProblem : null) ?? error}>
            <TextArea
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              disabled={pending}
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
