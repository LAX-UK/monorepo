"use client";

import {
  acceptBidderReofferAction,
  declineBidderReofferAction,
} from "@/lib/actions/bidder-reoffer";
import {
  bidderReofferEndedWhileAnswering,
  bidderReofferIsSettled,
} from "@/lib/reoffer/bidder-reoffer-errors";
import { REOFFER_LATE_PARAM, bidderReofferHref } from "@/lib/reoffer/bidder-reoffer-links";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/lax/button";
import { Checkbox } from "@auction/ui/lax/checkbox";
import { Dialog, DialogClose } from "@auction/ui/lax/dialog";
import { Field } from "@auction/ui/lax/field";
import { TextArea } from "@auction/ui/lax/input";
import { Notice } from "@auction/ui/lax/notice";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type Props = {
  reofferId: string;
  lotTitle: string;
};

const REASON_MAX = 500;

/**
 * The bidder's two answers. Accepting is one confirmed step: the terms box ticked, then the
 * button, with the total in view beside it. Declining asks for an optional reason in one field.
 * An offer that ended or changed while the person was answering reloads the page to show where it
 * stands, never a second try; a refusal that leaves the offer open (the account cannot accept)
 * stays here, said in words.
 */
export function ReofferOfferAnswer({ reofferId, lotTitle }: Props) {
  const router = useRouter();
  const termsId = useId();
  const hintId = useId();
  const [agreed, setAgreed] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [declinePending, startDecline] = useTransition();

  const settle = (code: string | undefined, message: string) => {
    setDeclining(false);
    if (bidderReofferEndedWhileAnswering(code)) {
      router.replace(`${bidderReofferHref(reofferId)}?${REOFFER_LATE_PARAM}=1`);
      return;
    }
    notify.error(message);
    router.refresh();
  };

  const accept = () => {
    setProblem(null);
    startTransition(async () => {
      const result = await acceptBidderReofferAction(reofferId, agreed);
      if (result.ok) {
        // The lot is theirs: Pay is ready on the new purchase.
        router.push(
          result.data ? `/purchases/${encodeURIComponent(result.data.lotId)}` : "/purchases",
        );
        return;
      }
      if (bidderReofferIsSettled(result.errorCode)) {
        settle(result.errorCode, result.error);
        return;
      }
      setProblem(result.error);
    });
  };

  const decline = () => {
    setProblem(null);
    startDecline(async () => {
      const result = await declineBidderReofferAction(reofferId, { reason });
      if (result.ok) {
        setDeclining(false);
        notify.success("Your answer was sent");
        router.refresh();
        return;
      }
      if (bidderReofferIsSettled(result.errorCode)) {
        settle(result.errorCode, result.error);
        return;
      }
      setProblem(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id={termsId}
          checked={agreed}
          onCheckedChange={(value) => setAgreed(value === true)}
          disabled={pending}
          className="mt-0.5"
        />
        <label htmlFor={termsId} className="text-lax-14 text-lax-fg">
          I agree to buy this lot at the total shown, under the{" "}
          <Link href="/terms" className="underline underline-offset-2">
            LAX Bid terms of sale
          </Link>
          .
        </label>
      </div>

      {problem && !declining ? (
        <Notice tone="danger" alert title="That didn't go through">
          {problem}
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-3 max-sm:flex-col">
        <Button
          variant="primary"
          loading={pending}
          onClick={accept}
          aria-describedby={agreed ? undefined : hintId}
          {...(agreed ? {} : { disabledReason: "Tick the box to accept" })}
        >
          Accept and continue
        </Button>
        <Button disabled={pending} onClick={() => setDeclining(true)}>
          Decline
        </Button>
      </div>
      {agreed ? null : (
        <p id={hintId} className="-mt-1 text-lax-13 text-lax-muted">
          Tick the box to accept.
        </p>
      )}

      <Dialog
        open={declining}
        onOpenChange={(open) => {
          setDeclining(open);
          if (!open) setProblem(null);
        }}
        title="Decline this offer?"
        description={`${lotTitle} won't be offered to you again.`}
        footerLayout="stacked"
        footer={
          <>
            <DialogClose asChild>
              <Button disabled={declinePending}>Back</Button>
            </DialogClose>
            <Button variant="primary" loading={declinePending} onClick={decline}>
              Yes, decline
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Anything you'd like to tell us?" optional>
            <TextArea
              rows={3}
              maxLength={REASON_MAX}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="For example: over budget now"
            />
          </Field>
          {problem ? (
            <Notice tone="danger" alert title="That didn't go through">
              {problem}
            </Notice>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}
