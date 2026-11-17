import { type LotCardBidAction, lotCardBidAction } from "@/lib/lot-card/lot-card-bid-action";
import type { LotStatus } from "@auction/types";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { Gavel } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  action: Extract<LotCardBidAction, { href: string }>;
};

/**
 * The full-width button in a lot card's action slot, on every lot grid. Its label names what it
 * does for this viewer (`lotCardBidAction`): "Bid", "Leave a bid", or the sale page's own register
 * step ("Register to bid", "Verify identity to bid", "Set up a buyer profile").
 */
export function LotCardAction({ action }: Props) {
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

/**
 * The action slot of a lot card on a grid of lots from many sales (search, home, artist and
 * department pages), where the card does not know the lot's sale or the viewer's register step:
 * "Bid" on an open lot (as the sale page's card says for it), and no button otherwise, rather than
 * a label for a step it cannot check. A lot selling on ATG is bid on there, so it gets none.
 */
export function lotCardGridAction(lot: {
  status: LotStatus;
  href: string;
  atgSaleState?: "live" | "ended" | undefined;
}): ReactNode {
  if (lot.atgSaleState) return null;
  const action = lotCardBidAction({
    lotStatus: lot.status,
    lotHref: lot.href,
    sale: null,
    viewer: null,
  });
  return action && action.kind !== "pending" ? <LotCardAction action={action} /> : null;
}
