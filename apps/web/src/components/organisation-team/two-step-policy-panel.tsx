"use client";

import { MemberInitials } from "@/components/legal-entity/members/member-initials";
import { initials } from "@/components/organisations/initials";
import type { TwoStepImpact } from "@/lib/organisation-team/two-step-impact";
import {
  remindTwoStepAction,
  setOrgTwoFactorPolicyAction,
} from "@/lib/security/two-factor-policy.actions";
import { notify } from "@/lib/ui/notify";
import { Button, Dialog, DialogClose, Meter, Notice, StatusBadge, Switch } from "@auction/ui/lax";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SettingsCard, SettingsRow } from "./settings-section";

type Props = {
  legalEntityId: string;
  organisationName: string;
  required: boolean;
  impact: TwoStepImpact;
  /** Only an owner changes the policy; admins see it. */
  canEdit: boolean;
  /** Owners and admins email the members without two-step a reminder. */
  canRemind: boolean;
};

function remindedWords(count: number): string {
  return count === 1 ? "We emailed 1 person a reminder" : `We emailed ${count} people a reminder`;
}

/**
 * The organisation's two-step policy: whether it is required and who has it on. Requiring it
 * first shows who is affected and what happens to each, so nobody is surprised at sign-in.
 */
export function TwoStepPolicyPanel({
  legalEntityId,
  organisationName,
  required,
  impact,
  canEdit,
  canRemind,
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [remindOnRequire, setRemindOnRequire] = useState(true);
  const [reminding, startReminding] = useTransition();
  const [remindError, setRemindError] = useState<string | null>(null);
  const offersReminder = canRemind && impact.affected.length > 0;

  const remind = () =>
    startReminding(async () => {
      setRemindError(null);
      const result = await remindTwoStepAction(legalEntityId);
      if (!result.ok) {
        setRemindError(result.error);
        return;
      }
      notify.success(remindedWords(result.reminded));
      router.refresh();
    });

  const save = (next: boolean) =>
    startTransition(async () => {
      setError(null);
      const result = await setOrgTwoFactorPolicyAction(legalEntityId, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const reminder =
        next && offersReminder && remindOnRequire ? await remindTwoStepAction(legalEntityId) : null;
      notify.success(next ? "Two-step is now required" : "Two-step is now optional", {
        ...(reminder?.ok ? { description: `${remindedWords(reminder.reminded)}.` } : {}),
      });
      if (reminder && !reminder.ok) notify.error(reminder.error);
      setConfirming(null);
      router.refresh();
    });

  return (
    <>
      <SettingsCard>
        <SettingsRow
          label="Policy"
          value={
            <StatusBadge tone={required ? "success" : "neutral"}>
              {required ? "Required" : "Not required"}
            </StatusBadge>
          }
          action={
            canEdit ? (
              required ? (
                <Button onClick={() => setConfirming(false)}>Make optional</Button>
              ) : (
                <Button variant="primary" onClick={() => setConfirming(true)}>
                  Require two-step
                </Button>
              )
            ) : null
          }
        />
        <div className="flex flex-col gap-2 px-4 py-4 md:px-5">
          <div className="text-lax-13 text-lax-muted">Who has it on</div>
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-lax-14 font-medium text-lax-fg tabular-nums">
              {impact.coverage}
            </span>
            <Meter
              value={impact.percent}
              label={`${impact.coverage} have two-step on`}
              className="max-w-48"
            />
          </div>
          <p className="text-lax-13 text-lax-muted">
            {impact.missingLine ?? "Everyone who acts for the organisation has it on."}
          </p>
          {offersReminder ? (
            <div className="flex flex-col items-start gap-2 pt-1">
              <Button size="sm" loading={reminding} onClick={remind}>
                Remind them
              </Button>
              {remindError ? <Notice tone="warning" title={remindError} /> : null}
            </div>
          ) : null}
        </div>
        {!canEdit ? (
          <p className="px-4 py-3 text-lax-13 text-lax-muted md:px-5">
            Only an owner changes the two-step policy.
          </p>
        ) : null}
      </SettingsCard>

      {confirming !== null ? (
        <Dialog
          open
          onOpenChange={(next) => (next || pending ? undefined : setConfirming(null))}
          title={
            confirming ? `Require two-step for ${organisationName}?` : "Make two-step optional?"
          }
          description={
            confirming
              ? impact.affected.length > 0
                ? `Everyone who acts for ${organisationName} will need two-step verification. These people don't have it on yet:`
                : "Everyone already has it on. New members will be asked to turn it on when they join."
              : "Members will be able to turn two-step off in their own LAX Account."
          }
          footer={
            <>
              <DialogClose asChild>
                <Button disabled={pending}>Cancel</Button>
              </DialogClose>
              <Button variant="primary" loading={pending} onClick={() => save(confirming)}>
                {confirming ? "Require two-step" : "Make optional"}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            {confirming && impact.affected.length > 0 ? (
              <>
                <ul className="divide-y divide-lax-line-subtle rounded-lax-card border border-lax-line">
                  {impact.affected.map((person) => (
                    <li key={person.userId} className="flex items-center gap-3 px-4 py-3">
                      <MemberInitials>{initials(person.name)}</MemberInitials>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-lax-14 font-medium text-lax-fg">{person.name}</span>
                        <span className="text-lax-13 text-lax-muted">{person.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-lax-13 text-lax-muted">
                  They&apos;ll be asked to turn it on at their next sign-in, and can&apos;t act for{" "}
                  {organisationName} until they do. Nobody is signed out now.
                </p>
                {offersReminder ? (
                  <div className="flex items-center justify-between gap-4 rounded-lax-card border border-lax-line px-4 py-3">
                    <span id="remind-on-require" className="text-lax-14 font-medium text-lax-fg">
                      Email them a reminder now
                    </span>
                    <Switch
                      aria-labelledby="remind-on-require"
                      checked={remindOnRequire}
                      onCheckedChange={setRemindOnRequire}
                      disabled={pending}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
            {error ? <Notice tone="danger" alert title={error} /> : null}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
