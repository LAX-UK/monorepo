import { Button } from "@auction/ui/components/button";
import { Gavel } from "lucide-react";
import Link from "next/link";

type Props = {
  lotHref: string;
};

const bidClass =
  "box-border h-10 min-w-0 w-full rounded-[4px] border border-brand-200 bg-transparent font-body text-base font-semibold leading-6 tracking-[0.8px] text-brand-800 hover:bg-transparent dark:border-outline-variant/50 dark:text-on-surface";

/** Per-lot bid CTA for saleroom catalogue cards. Watchlist/quick-look overlay on grid; inline beside title on list. */
export function SaleroomLotActions({ lotHref }: Props) {
  return (
    <Button asChild variant="ghost" className={`${bidClass} px-6 shadow-none hover:opacity-90`}>
      <Link className="w-full justify-center" href={lotHref}>
        <Gavel className="mr-2.5 size-4 shrink-0" aria-hidden />
        Bid
      </Link>
    </Button>
  );
}
