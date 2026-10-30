"use client";

import { parsePounds } from "@/lib/buyer-agents/authorisation-draft";
import { setOrganisationBiddingLimitAction } from "@/lib/organisation-team/organisation-team.actions";
import { notify } from "@/lib/ui/notify";
import { Button, Dialog, DialogClose, Field, Notice, TextInput } from "@auction/ui/lax";
import { BUYER_AGENT_BID_LIMIT_MAX } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  legalEntityId: string;
  organisationName: string;
  /** The limit now, in pounds; `null` when there is none. */
  current: number | null;
  onClose: () => void;
};

function amountProblem(text: string): string | null {
  const value = parsePounds(text);
  if (value == null) return "Enter the limit in pounds, like 250,000.";
  if (Number.isNaN(value) || value <= 0) return "Enter an amount in pounds, like 250,000.";
  if (value > BUYER_AGENT_BID_LIMIT_MAX) return "Enter a smaller amount.";
  return null;
}

/**
 * Set, change or remove the organisation's bidding limit: the most everyone bidding for it may
 * have committed at once, owners and admins included. A refusal from the server is said in the
 * dialog, which stays open.
 */
export function OrganisationLimitDialog({
  legalEntityId,
  organisationName,
  current,
  onClose,
}: Props) {
  const router = useRouter();
  const [text, setText] = useState(current ? current.toLocaleString("en-GB") : "");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const problem = amountProblem(text);

  const save = (limit: number | null) =>
    startTransition(async () => {
      setError(null);
      const result = await setOrganisationBiddingLimitAction(legalEntityId, limit);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      notify.success(limit === null ? "Bidding limit removed" : "Bidding limit saved", {
        description:
          limit === null
            ? `Only each person's own limits apply to ${organisationName} now.`
            : "It applies from the next bid.",
      });
      onClose();
      router.refresh();
    });

  return (
    <Dialog
      open
      onOpenChange={(next) => (next || pending ? undefined : onClose())}
      title={current ? "Change the bidding limit" : "Set a bidding limit"}
      description={`The most everyone bidding for ${organisationName} can have committed at once, owners and admins included. The lowest limit always applies.`}
      footer={
        <>
          {current ? (
            <Button
              variant="danger-secondary"
              disabled={pending}
              onClick={() => save(null)}
              className="md:mr-auto"
            >
              Remove the limit
            </Button>
          ) : null}
          <DialogClose asChild>
            <Button disabled={pending}>Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            loading={pending}
            onClick={() => {
              setTried(true);
              const value = parsePounds(text);
              if (!problem && value != null) save(value);
            }}
          >
            Save limit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Limit"
          description="Leading and maximum bids, absentee bids and unpaid wins all count."
          error={tried ? problem : null}
        >
          <TextInput
            leading={<span className="text-lax-14 text-lax-muted">£</span>}
            inputMode="decimal"
            autoComplete="off"
            placeholder="250,000"
            className="tabular-nums"
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={pending}
          />
        </Field>
        {error ? <Notice tone="danger" alert title={error} /> : null}
      </div>
    </Dialog>
  );
}
