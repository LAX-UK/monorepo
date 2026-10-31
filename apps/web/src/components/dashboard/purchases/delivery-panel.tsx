"use client";

import type { CollectionVm, DeliveryPanelVm } from "@/lib/purchases/purchase-delivery.vm";
import {
  type QuoteStepResult,
  acceptDeliveryQuoteAction,
  requestDeliveryQuoteAction,
  withdrawDeliveryQuoteAction,
} from "@/lib/purchases/purchase.actions";
import { Button, ButtonLink, Field, Notice, PresetCards, TextArea } from "@auction/ui/lax";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Choice = "courier" | "shipper" | "collect";

const CHOICES = [
  {
    value: "courier",
    label: "Courier quote",
    description: "We quote insured delivery to your address, usually within 2 working days.",
  },
  {
    value: "shipper",
    label: "Your own shipper",
    description: "Name the shipper and we release the work to them.",
  },
  {
    value: "collect",
    label: "Collect in London",
    description: "From our saleroom, at a time you book with us.",
  },
] as const;

/** Runs a delivery step, refreshes the page, and keeps the message of a refusal. */
function useStep() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (step: () => Promise<QuoteStepResult>) =>
    start(async () => {
      setError(null);
      const result = await step();
      if (result.ok) router.refresh();
      else setError(result.message);
    });
  return { pending, error, run };
}

function CollectionDetails({ collection }: { collection: CollectionVm | null }) {
  if (!collection) {
    return (
      <p className="text-lax-14 text-lax-muted">
        Collection details are on their way. We'll email you when you can book a time.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 text-lax-14 sm:grid-cols-[8rem_minmax(0,1fr)]">
        {collection.place ? (
          <>
            <dt className="text-lax-muted">Address</dt>
            <dd className="text-lax-fg">{collection.place}</dd>
          </>
        ) : null}
        {collection.hours ? (
          <>
            <dt className="text-lax-muted">Opening hours</dt>
            <dd className="text-lax-fg">{collection.hours}</dd>
          </>
        ) : null}
      </dl>
      {collection.bookingEmail ? (
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink
            href={`mailto:${collection.bookingEmail}?subject=${encodeURIComponent("Book a collection")}`}
          >
            Email us to book
          </ButtonLink>
          <p className="text-lax-13 text-lax-muted">
            Tell us the day, and who will collect. We confirm by email.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CourierForm({ lotId, intro }: { lotId: string; intro: string | null }) {
  const [destination, setDestination] = useState("");
  const { pending, error, run } = useStep();
  const tooShort = destination.trim().length < 5;
  return (
    <div className="flex flex-col gap-4">
      {intro ? <p className="text-lax-14 text-lax-muted">{intro}</p> : null}
      <Field label="Deliver to" description="The full address, with the postcode." error={error}>
        <TextArea
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          rows={3}
          maxLength={500}
          autoComplete="street-address"
        />
      </Field>
      <div>
        <Button
          variant="primary"
          loading={pending}
          onClick={() => run(() => requestDeliveryQuoteAction(lotId, destination))}
          {...(tooShort ? { disabledReason: "Enter the delivery address first" } : {})}
        >
          Ask for a quote
        </Button>
      </div>
    </div>
  );
}

/**
 * The delivery panel of a purchase: choose courier, own shipper or collection; then the courier
 * quote as it is priced and accepted; then where the work is. Steps come from the server's
 * answer, so the panel only offers what will work for this member.
 */
export function DeliveryPanel({
  lotId,
  panel,
  shipperEmail,
}: {
  lotId: string;
  panel: DeliveryPanelVm;
  /** Where to send a shipper's details. */
  shipperEmail: string;
}) {
  const [choice, setChoice] = useState<Choice>("courier");
  const step = useStep();

  switch (panel.kind) {
    case "told":
    case "done":
      return <p className="text-lax-14 text-lax-fg">{panel.line}</p>;
    case "in-transit":
      return (
        <p className="text-lax-14 text-lax-fg">
          {panel.line}
          {panel.tracking ? ` Tracking ${panel.tracking}.` : ""}
        </p>
      );
    case "collect":
      return (
        <div className="flex flex-col gap-4">
          <p className="text-lax-14 text-lax-fg">{panel.line}</p>
          <CollectionDetails collection={panel.collection} />
        </div>
      );
    case "quote-requested":
      return (
        <div className="flex flex-col gap-4">
          <p className="text-lax-14 text-lax-fg">
            <span className="font-medium">Quote requested.</span> {panel.line}
          </p>
          {step.error ? <Notice tone="danger" alert title={step.error} /> : null}
          {panel.canWithdraw ? (
            <div>
              <Button
                loading={step.pending}
                onClick={() => step.run(() => withdrawDeliveryQuoteAction(lotId))}
              >
                Withdraw request
              </Button>
            </div>
          ) : null}
        </div>
      );
    case "quote-ready":
      return (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-lax-20 font-semibold tabular-nums text-lax-fg">{panel.amount}</p>
            <p className="mt-1 text-lax-14 text-lax-muted">
              Insured delivery to {panel.destination}
              {panel.note ? `. ${panel.note}` : "."}
            </p>
          </div>
          <p className="text-lax-13 text-lax-muted">
            Accepting books the delivery and adds its price to what is owed for this lot.
          </p>
          {step.error ? <Notice tone="danger" alert title={step.error} /> : null}
          {panel.canAccept || panel.canDecline ? (
            <div className="flex flex-wrap gap-3">
              {panel.canAccept ? (
                <Button
                  variant="primary"
                  loading={step.pending}
                  onClick={() => step.run(() => acceptDeliveryQuoteAction(lotId))}
                >
                  Accept quote
                </Button>
              ) : null}
              {panel.canDecline ? (
                <Button
                  disabled={step.pending}
                  onClick={() => step.run(() => withdrawDeliveryQuoteAction(lotId))}
                >
                  Decline
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    case "choose":
      if (panel.beforePayment) {
        return (
          <CourierForm
            lotId={lotId}
            intro="You can ask for a courier quote before you pay, so you know the full cost. Collection and your own shipper open once the invoice is paid."
          />
        );
      }
      return (
        <div className="flex flex-col gap-5">
          <PresetCards<Choice>
            label="Delivery"
            value={choice}
            onValueChange={setChoice}
            options={CHOICES}
          />
          {choice === "courier" ? <CourierForm lotId={lotId} intro={null} /> : null}
          {choice === "shipper" ? (
            <div className="flex flex-col gap-3">
              <p className="text-lax-14 text-lax-muted">
                Email us your shipper's name and when they will collect. We release the work once we
                have checked who they are.
              </p>
              <div>
                <ButtonLink
                  href={`mailto:${shipperEmail}?subject=${encodeURIComponent("Release to our shipper")}`}
                >
                  Email your shipper's details
                </ButtonLink>
              </div>
            </div>
          ) : null}
          {choice === "collect" ? <CollectionDetails collection={panel.collection} /> : null}
        </div>
      );
  }
}
