"use client";

import { invitationCopy } from "@/lib/legal-entity/member-change-copy";
import { inviteMemberAction } from "@/lib/legal-entity/member-management.actions";
import {
  organisationRoleDescription,
  organisationRoleLabel,
  organisationRoleOptions,
} from "@/lib/presenters/organisation-role/organisation-role-presentation";
import { notify } from "@/lib/ui/notify";
import type { LegalEntityMemberRole } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { LabelledSelect } from "@auction/ui/components/labelled-select";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { useEffect, useId, useRef, useState } from "react";

type Props = {
  legalEntityId: string;
  organisationName: string;
  /** The roles this person may invite someone as (from the member change policy). */
  roleOptions: readonly LegalEntityMemberRole[];
};

const PREFERRED_ROLE: LegalEntityMemberRole = "consignor";
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** The email field's problem, or `null` when it can be sent. */
export function inviteEmailError(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Enter the email address of the person to invite.";
  if (!EMAIL_SHAPE.test(trimmed)) return "Enter an email address like name@example.com.";
  return null;
}

/**
 * Invite someone: email, role and Send invitation on one line (stacked on phones), all at the
 * same height. A failed send lists what to fix at the top and moves focus there; a problem with
 * the address is also shown under the field, and anything else above the button.
 */
export function InviteMemberForm({ legalEntityId, organisationName, roleOptions }: Props) {
  const ids = { email: useId(), role: useId(), roleHint: useId(), summary: useId() };
  const defaultRole = roleOptions.includes(PREFERRED_ROLE)
    ? PREFERRED_ROLE
    : (roleOptions[0] ?? PREFERRED_ROLE);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<LegalEntityMemberRole>(defaultRole);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  // After a failed send, the summary takes focus so the problem is read out first.
  useEffect(() => {
    if (attempt > 0 && emailError) summaryRef.current?.focus();
  }, [attempt, emailError]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const problem = inviteEmailError(email);
    setEmailError(problem);
    setAttempt((n) => n + 1);
    if (problem) return;
    setPending(true);
    const address = email.trim();
    const result = await inviteMemberAction(legalEntityId, address, role);
    setPending(false);
    if (!result.ok) {
      if (result.code === "already_a_member") {
        setEmailError(`${address} is already a member of ${organisationName}.`);
        setAttempt((n) => n + 1);
      } else {
        setFormError(result.error);
      }
      return;
    }
    notify.success(invitationCopy.sent(address).title);
    setEmail("");
    setRole(defaultRole);
    setAttempt(0);
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
      {emailError && attempt > 0 ? (
        <Alert variant="destructive" ref={summaryRef} tabIndex={-1} aria-labelledby={ids.summary}>
          <AlertTitle id={ids.summary} className="font-body text-sm font-semibold">
            Check the invitation
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-none">
              <li>
                <a href={`#${ids.email}`} className="underline underline-offset-2">
                  {emailError}
                </a>
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-start">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={ids.email} className="leading-5">
            Email
          </Label>
          <Input
            id={ids.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              // Once a send has failed, re-check the field as it changes.
              if (attempt > 0) setEmailError(inviteEmailError(event.target.value));
            }}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? `${ids.email}-error` : undefined}
            className={emailError ? "border-error" : undefined}
          />
          {emailError ? (
            <p id={`${ids.email}-error`} className="font-body text-label-3 leading-5 text-error">
              {emailError}
            </p>
          ) : null}
        </div>
        <LabelledSelect
          id={ids.role}
          label="Role"
          options={organisationRoleOptions(roleOptions)}
          value={role}
          onValueChange={setRole}
        />
        {/* On phones the role's description sits under the role, before the button. */}
        <p
          id={ids.roleHint}
          className="-mt-2 font-body text-label-3 leading-5 text-on-surface-variant sm:order-last sm:col-span-3 sm:mt-0"
        >
          <span className="font-medium text-on-surface">{organisationRoleLabel(role)}:</span>{" "}
          {lowerFirst(organisationRoleDescription(role))} Invitation links work for 7 days.
        </p>
        <div className="flex flex-col gap-1.5">
          {/* Keeps the button on the fields' line, under a label-height gap. */}
          <span aria-hidden className="hidden h-5 sm:block" />
          <LoadingButton
            type="submit"
            variant="primary"
            size="default"
            loading={pending}
            loadingLabel="Sending…"
            disabledReason={email.trim() ? undefined : "Enter an email address first."}
          >
            Send invitation
          </LoadingButton>
        </div>
      </div>

      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
