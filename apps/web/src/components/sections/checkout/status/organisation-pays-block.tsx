import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { CircleCheck, Clock } from "lucide-react";
import Link from "next/link";

type Props = {
  /** The organisation that pays: "Northbank Gallery", or "your organisation" when unknown. */
  payer: string;
  /** Paid already, or still waiting for the organisation's payers. */
  paid: boolean;
};

function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Checkout for the member who won a lot their organisation pays for (a buyer agent). They are
 * told how payment is going and where to follow the lot; there is nothing for them to pay.
 */
export function OrganisationPaysBlock({ payer, paid }: Props) {
  const Icon = paid ? CircleCheck : Clock;
  const team = `${possessive(payer)} finance team`;
  return (
    <Surface variant="section" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Icon
          className={
            paid
              ? "mt-0.5 size-5 shrink-0 text-success"
              : "mt-0.5 size-5 shrink-0 text-on-surface-variant"
          }
          strokeWidth={1.75}
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <h2 className="font-headline text-lg font-semibold leading-[26px] text-on-surface">
            {paid ? `Paid by ${team}` : `Waiting for payment by ${payer}`}
          </h2>
          <p className="max-w-[72ch] font-body text-sm text-on-surface-variant">
            {paid
              ? `${capitalise(team)} has paid for this lot and arranges its delivery. You can follow it in Purchases.`
              : `${capitalise(possessive(payer))} owners, admins and finance team pay for the lots you win for it. This lot moves on in Purchases once they have paid.`}
          </p>
        </div>
      </div>
      <div>
        <Button asChild variant="secondaryOutline">
          <Link href={CLIENT_ROUTES.purchases}>Back to purchases</Link>
        </Button>
      </div>
    </Surface>
  );
}
