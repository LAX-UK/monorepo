import type { ArtAccountPromoVm } from "@/lib/account/account-profile.vm";
import { MarketingCardShell } from "@auction/marketing-ui";
import Link from "next/link";

/** How to buy / How to sell / FAQs cards at the foot of the profile (Figma 867:16367). */
export function ArtAccountPromoCards({ promos }: { promos: readonly ArtAccountPromoVm[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {promos.map((promo) => (
        <li key={promo.href}>
          <MarketingCardShell asChild className="h-full border border-border-hairline">
            <Link href={promo.href} className="flex h-full flex-col gap-3 p-6">
              <h3 className="font-headline text-xl font-medium text-on-surface">{promo.title}</h3>
              <p className="flex-1 text-sm text-on-surface-variant">{promo.description}</p>
              <span className="text-sm font-medium text-on-surface underline underline-offset-4">
                {promo.label} <span aria-hidden>→</span>
              </span>
            </Link>
          </MarketingCardShell>
        </li>
      ))}
    </ul>
  );
}
