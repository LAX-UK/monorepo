"use client";

import { answerSellerReofferAction } from "@/lib/actions/seller-reoffer";
import { sellerReofferIsSettled } from "@/lib/seller/seller-reoffer-errors";
import { PAYMENT_TERM } from "@/lib/seller/seller-reoffer.vm";
import { notify } from "@/lib/ui/notify";
import { RadioCardGroup } from "@auction/ui/components/radio-card-group";
import { Button } from "@auction/ui/lax/button";
import { Dialog, DialogClose } from "@auction/ui/lax/dialog";
import { Notice } from "@auction/ui/lax/notice";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type DeclinePreference = "later_sale" | "return_to_me" | "talk_to_us";

const PREFERENCES: ReadonlyArray<{
  value: DeclinePreference;
  label: string;
  description?: string;
}> = [
  { value: "later_sale", label: "Include it in a later sale" },
  {
    value: "return_to_me",
    label: "Return it to me",
    description: "Collection or delivery costs may apply under your agreement.",
  },
  { value: "talk_to_us", label: "I'd like to talk to someone" },
];

type Props = {
  reofferId: string;
  lotTitle: string;
  /** "£76,000.00": the price the sheet repeats before the seller agrees. */
  offer: string;
  /**
   * "You receive £62,320.00: the offer of £76,000.00 less your 15% commission and VAT, under your
   * signed agreement."; `null` for a member who does not see the payouts.
   */
  consent: string | null;
};

/**
 * The seller's two answers. Agree asks once more, with the price and what they would receive under their agreement;
 * "Not this time" asks what they would rather happen. A request that closed or was answered while
 * the sheet was open reloads the page to show where it stands, never a second try.
 */
export function SellerReofferAnswer({ reofferId, lotTitle, offer, consent }: Props) {
  const router = useRouter();
  const [sheet, setSheet] = useState<"agree" | "decline" | null>(null);
  const [preference, setPreference] = useState<DeclinePreference | "">("");
  const [problem, setProblem] = useState<string | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setSheet(null);
    setProblem(null);
    setMissing(null);
  };

  const send = (answer: { answer: "given" } | { answer: "refused"; declinePreference: string }) => {
    setProblem(null);
    startTransition(async () => {
      const result = await answerSellerReofferAction(reofferId, answer);
      if (result.ok) {
        notify.success(
          answer.answer === "given" ? "Your agreement was sent" : "Your answer was sent",
        );
        close();
        router.refresh();
        return;
      }
      if (sellerReofferIsSettled(result.errorCode)) {
        close();
        notify.error(result.error);
        router.refresh();
        return;
      }
      setProblem(result.error);
    });
  };

  const decline = () => {
    if (!preference) {
      setMissing("Choose what you'd like us to do.");
      return;
    }
    send({ answer: "refused", declinePreference: preference });
  };

  return (
    <>
      <div className="flex flex-wrap gap-3 max-sm:flex-col">
        <Button variant="primary" onClick={() => setSheet("agree")}>
          Agree
        </Button>
        <Button onClick={() => setSheet("decline")}>Not this time</Button>
      </div>

      <Dialog
        open={sheet === "agree"}
        onOpenChange={(open) => (open ? setSheet("agree") : close())}
        title={`Agree to offer ${lotTitle} to the next bidder at ${offer}?`}
        description={`We'll send them the offer shortly. If they accept, they pay within ${PAYMENT_TERM} and we pay you once it clears.${consent ? ` ${consent}` : ""}`}
        footerLayout="stacked"
        footer={
          <>
            <DialogClose asChild>
              <Button disabled={pending}>Cancel</Button>
            </DialogClose>
            <Button variant="primary" loading={pending} onClick={() => send({ answer: "given" })}>
              Yes, agree
            </Button>
          </>
        }
      >
        {problem ? (
          <Notice tone="danger" alert title="That didn't go through">
            {problem}
          </Notice>
        ) : null}
      </Dialog>

      <Dialog
        open={sheet === "decline"}
        onOpenChange={(open) => (open ? setSheet("decline") : close())}
        title="What would you like instead?"
        footerLayout="stacked"
        footer={
          <>
            <DialogClose asChild>
              <Button disabled={pending}>Back</Button>
            </DialogClose>
            <Button variant="primary" loading={pending} onClick={decline}>
              Send my answer
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <RadioCardGroup
            legend="What would you like us to do?"
            hideLegend
            value={preference}
            onValueChange={(value) => {
              setPreference(value as DeclinePreference);
              setMissing(null);
            }}
            options={PREFERENCES}
            {...(missing ? { error: missing } : {})}
          />
          {problem ? (
            <Notice tone="danger" alert title="That didn't go through">
              {problem}
            </Notice>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
