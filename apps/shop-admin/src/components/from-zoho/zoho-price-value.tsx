import { zohoPriceMinor } from "@/lib/zoho-price";
import { StaffMoney } from "@auction/staff-ui";

/** Words for a Product Zoho has no price on. */
export const ZOHO_PRICE_NOT_SET = "Not set in Zoho";

/**
 * Zoho's price as information: the amount, or "Not set in Zoho" in muted text. It carries no tone;
 * the LAX price is set when the work is offered, so a missing Zoho price is not a gap.
 */
export function ZohoPriceValue({ zohoPrice }: { zohoPrice: string | null }) {
  const minor = zohoPriceMinor(zohoPrice);
  if (minor === null) return <span className="text-staff-muted">{ZOHO_PRICE_NOT_SET}</span>;
  return <StaffMoney minor={minor} />;
}
