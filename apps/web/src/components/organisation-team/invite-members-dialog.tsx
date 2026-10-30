"use client";

import { inviteMemberAction } from "@/lib/legal-entity/member-management.actions";
import { teamHref } from "@/lib/navigation/client-routes";
import {
  type InviteOutcome,
  inviteBatchProblem,
  inviteEmailProblem,
  normaliseInviteEmail,
  sendInvitesLabel,
  summariseInviteBatch,
} from "@/lib/organisation-team/invite-batch";
import {
  organisationRoleDescription,
  organisationRoleLabel,
} from "@/lib/presenters/organisation-role/organisation-role-presentation";
import { notify } from "@/lib/ui/notify";
import type { LegalEntityMemberRole } from "@auction/types";
import {
  Button,
  Dialog,
  DialogClose,
  Field,
  Notice,
  PresetCards,
  TokenInput,
} from "@auction/ui/lax";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  legalEntityId: string;
  organisationName: string;
  /** The roles this person may invite as, from the member change rules; never empty here. */
  roleOptions: readonly LegalEntityMemberRole[];
};

/** Least access first: a new invitation starts on the role that can do the least. */
function defaultRole(roles: readonly LegalEntityMemberRole[]): LegalEntityMemberRole {
  return roles.includes("viewer") ? "viewer" : (roles[roles.length - 1] as LegalEntityMemberRole);
}

/**
 * "Invite members": the page's primary action, and a dialog that takes several addresses (typed,
 * or pasted as a list) and one role, each role with what it can do. Every address is sent on its
 * own; any that are refused stay in the field with their reason, and the rest go out.
 */
export function InviteMembersButton({ legalEntityId, organisationName, roleOptions }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [role, setRole] = useState<LegalEntityMemberRole>(() => defaultRole(roleOptions));
  const [failures, setFailures] = useState<{ email: string; error: string }[]>([]);
  const [tried, setTried] = useState(false);
  const [pending, startTransition] = useTransition();

  const problem = inviteBatchProblem(emails);
  const reset = () => {
    setEmails([]);
    setFailures([]);
    setTried(false);
    setRole(defaultRole(roleOptions));
  };

  const send = () => {
    setTried(true);
    if (problem) return;
    startTransition(async () => {
      const outcomes: InviteOutcome[] = [];
      for (const email of emails) {
        const result = await inviteMemberAction(legalEntityId, email, role);
        outcomes.push(result.ok ? { email, ok: true } : { email, ok: false, error: result.error });
      }
      const summary = summariseInviteBatch(outcomes, organisationName);
      if (summary.sentTitle) {
        notify.success(summary.sentTitle, {
          description: "They'll get an email with a link that works for 7 days.",
        });
        router.refresh();
      }
      if (summary.failed.length === 0) {
        setOpen(false);
        reset();
        return;
      }
      setEmails(summary.failed.map((f) => f.email));
      setFailures(summary.failed);
    });
  };

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Invite members
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
          if (!next) reset();
        }}
        wide
        title={`Invite members to ${organisationName}`}
        description="We'll email each person a link to join."
        footer={
          <>
            <span className="mr-auto text-lax-12 text-lax-muted max-md:basis-full max-md:text-center">
              Invitations expire after 7 days.
            </span>
            <DialogClose asChild>
              <Button disabled={pending}>Cancel</Button>
            </DialogClose>
            <Button variant="primary" loading={pending} onClick={send}>
              {sendInvitesLabel(Math.max(emails.length, 1))}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {failures.length > 0 ? (
            <Notice tone="warning" alert title="Some invitations didn't go out">
              <ul className="mt-1 flex flex-col gap-0.5">
                {failures.map((failure) => (
                  <li key={failure.email}>
                    <span className="font-medium text-lax-fg">{failure.email}</span>:{" "}
                    {failure.error}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : null}
          <Field
            label="Email addresses"
            description="Add several, separated by commas, or paste a list."
            error={tried ? problem : null}
          >
            <TokenInput
              value={emails}
              onValueChange={(next) => {
                setEmails(next);
                setFailures((list) => list.filter((f) => next.includes(f.email)));
              }}
              normalise={normaliseInviteEmail}
              validate={inviteEmailProblem}
              placeholder="name@example.com"
              disabled={pending}
            />
          </Field>
          <fieldset className="flex flex-col gap-1.5" disabled={pending}>
            <legend className="mb-1.5 text-lax-ui font-medium text-lax-fg">Role</legend>
            <PresetCards
              label="Role"
              columns={1}
              compact
              value={role}
              onValueChange={setRole}
              options={roleOptions.map((value) => ({
                value,
                label: organisationRoleLabel(value),
                description: organisationRoleDescription(value),
              }))}
            />
          </fieldset>
          {role === "buyer_agent" ? (
            <p className="text-lax-13 text-lax-muted">
              Buyer agents bid once you authorise them. After they join, set their sales and limits
              in{" "}
              <Link
                href={teamHref("bidding")}
                className="font-medium text-lax-fg underline decoration-lax-line-strong underline-offset-4 hover:decoration-current"
                onClick={() => setOpen(false)}
              >
                Who can bid
              </Link>
              .
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
