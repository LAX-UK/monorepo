import { ButtonLink } from "@auction/ui/lax";
import { Gavel } from "lucide-react";
import Link from "next/link";

type Props = {
  lotHref: string;
};

/** Per-lot bid CTA for saleroom catalogue cards. Watchlist/quick-look overlay on grid; inline beside title on list. */
export function SaleroomLotActions({ lotHref }: Props) {
  return (
    <ButtonLink
      Link={Link}
      href={lotHref}
      variant="secondary"
      icon={<Gavel aria-hidden />}
      className="w-full"
    >
      Bid
    </ButtonLink>
  );
}
