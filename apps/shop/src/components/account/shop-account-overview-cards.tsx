import type { BuildShopAccountNavItemsInput } from "@/lib/account/account-nav.vm";
import { cn } from "@auction/ui";
import Link from "next/link";

type Card = {
  href: string;
  title: string;
  description: string;
};

function buildCards(input: BuildShopAccountNavItemsInput): Card[] {
  const cards: Card[] = [
    {
      href: "/account/orders",
      title: "Orders",
      description: "Track purchases and payment status.",
    },
  ];
  if (input.portalOwnershipEnabled) {
    cards.push(
      {
        href: "/account/editions",
        title: "My editions",
        description: "Edition numbers assigned to your works.",
      },
      {
        href: "/account/sale-limits",
        title: "Sale limits",
        description: "Authorised and committed sale authority.",
      },
    );
  }
  if (input.payoutsEnabled) {
    cards.push(
      {
        href: "/account/sales",
        title: "Sales statement",
        description: "Per-sale gross, fees and net linked to payouts.",
      },
      {
        href: "/account/payouts",
        title: "Payouts",
        description: "Gross, deductions and net payout history.",
      },
      {
        href: "/account/documents",
        title: "Documents",
        description: "Certificates and invoices.",
      },
    );
  }
  return cards;
}

export function ShopAccountOverviewCards(props: BuildShopAccountNavItemsInput) {
  const cards = buildCards(props);

  return (
    <ul className="shop-account-overview">
      {cards.map((card) => (
        <li key={card.href}>
          <Link href={card.href} className={cn("shop-account-overview__card shop-focus-ring")}>
            <span className="shop-account-overview__title">{card.title}</span>
            <span className="shop-account-overview__desc">{card.description}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
