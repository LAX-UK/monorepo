import {
  SaleTelephoneBookingPanel,
  type SaleTelephoneBookingPanelProps,
} from "@/components/marketing/sale-telephone-booking-panel";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";

/** Semantic section landmark for telephone bidding — panel owns card chrome and heading. */
export function SaleTelephoneBiddingSection(props: SaleTelephoneBookingPanelProps) {
  return (
    <section
      id="telephone"
      aria-label="Telephone bidding"
      className={cn(
        MARKETING_PAGE_SHELL,
        "scroll-mt-[calc(var(--header-height)+3.5rem)] pb-0 pt-16",
      )}
    >
      <SaleTelephoneBookingPanel {...props} />
    </section>
  );
}
