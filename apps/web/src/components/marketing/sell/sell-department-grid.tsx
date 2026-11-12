import { MarketingSection } from "@/components/marketing/marketing-section";
import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { FOCUS_RING, MARKETING_CARD_LIFT } from "@/lib/marketing/chrome";
import { sellDepartmentIcon } from "@/lib/marketing/sell-department-icons";
import { SELL_A_WORK_LABEL } from "@/lib/marketing/sell-flow-copy";
import {
  SELL_SECTION_IDS,
  type SellDepartmentCard,
  sellDepartmentCards,
} from "@/lib/marketing/sell-landing";
import { cn } from "@auction/ui/lib/utils";
import Link from "next/link";

const CARD_CLASS = cn(
  "group relative flex h-full flex-col justify-between gap-4 rounded-lg border border-border-hairline bg-surface-container-lowest p-4",
  MARKETING_CARD_LIFT,
  FOCUS_RING,
);

function CardBody({ card }: { card: SellDepartmentCard }) {
  const Icon = sellDepartmentIcon(card.id);
  return (
    <>
      <div className="flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-container-low text-on-surface"
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-headline text-base font-medium text-on-surface">{card.label}</p>
          {card.examples ? (
            <p className="font-body text-sm text-on-surface-variant">{card.examples}</p>
          ) : null}
        </div>
      </div>
      <p className="font-label text-sm font-medium text-on-surface-variant">
        {card.opensDepartmentPage ? "About this department" : SELL_A_WORK_LABEL}
        <span aria-hidden> →</span>
      </p>
    </>
  );
}

function DepartmentCardLink({ card }: { card: SellDepartmentCard }) {
  if (card.opensDepartmentPage) {
    return (
      <Link href={card.href} data-testid={`sell-department-${card.id}`} className={CARD_CLASS}>
        <CardBody card={card} />
      </Link>
    );
  }
  return (
    <SellCtaLink
      href={card.href}
      source={`sell_dept_${card.id}`}
      data-testid={`sell-department-${card.id}`}
      className={CARD_CLASS}
    >
      <CardBody card={card} />
    </SellCtaLink>
  );
}

/** One card for each department we sell, opening its page or the form with it chosen. */
export function SellDepartmentGrid() {
  return (
    <MarketingSection
      id={SELL_SECTION_IDS.departments}
      heading="Departments"
      subtitle="Choose a department to see what we look for, or send a work straight away."
    >
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sellDepartmentCards().map((card) => (
          <li key={card.id}>
            <DepartmentCardLink card={card} />
          </li>
        ))}
      </ul>
    </MarketingSection>
  );
}
