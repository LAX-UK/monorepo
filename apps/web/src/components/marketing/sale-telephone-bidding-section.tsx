import {
  SaleTelephoneBookingCard,
  type SaleTelephoneBookingCardProps,
} from "@/components/marketing/sale-telephone-booking-card";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui/lib/utils";

/** Semantic section landmark for telephone bidding — card owns its chrome and heading. */
export function SaleTelephoneBiddingSection(props: SaleTelephoneBookingCardProps) {
  return (
    <section
      id="telephone"
      aria-label="Telephone bidding"
      className={cn(
        MARKETING_PAGE_SHELL,
        "scroll-mt-[calc(var(--header-height)+3.5rem)] pb-0 pt-16",
      )}
    >
      <SaleTelephoneBookingCard {...props} />
    </section>
  );
}
