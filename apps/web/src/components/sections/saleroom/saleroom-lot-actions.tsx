import type { LotCardBidAction } from "@/lib/lot-card/lot-card-bid-action";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { Gavel } from "lucide-react";
import Link from "next/link";

type Props = {
  action: Extract<LotCardBidAction, { href: string }>;
};

/**
 * The full-width button of a sale page lot card. Its label names what it does for this viewer
 * (`lotCardBidAction`): "Bid", "Register to bid" or "Leave a bid".
 */
export function SaleroomLotActions({ action }: Props) {
  return (
    <ButtonLink
      Link={Link}
      href={action.href}
      variant="secondary"
      icon={<Gavel aria-hidden />}
      className="w-full"
    >
      {action.label}
    </ButtonLink>
  );
}
