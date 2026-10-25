import {
  SITE_BUSINESS_ADDRESS_INLINE,
  SITE_COMPANY_NAME,
  legalEntityFacts,
  legalEntityFor,
} from "@auction/branding";
import { FULFILMENT_SURCHARGE_PENCE } from "@auction/shop-domain";
import { formatGbpPence } from "@auction/shop-portal/vm";

/**
 * Facts the policy pages share. Values confirmed in code are read from their source so the pages
 * cannot drift from checkout; everything else is a visible `[TO CONFIRM: …]` placeholder.
 */
/** LAX Shop is operated by London Art Exchange Ltd; its details come from `@auction/branding`. */
const SELLER = legalEntityFacts(legalEntityFor("shop"));

export const SHOP_POLICY_FACTS = {
  sellerLegalName: SELLER.name,
  sellerTradingName: SITE_COMPANY_NAME,
  companyNumber: SELLER.companyNumber,
  registeredIn: SELLER.registeredIn,
  registeredAddress: SELLER.registeredAddress,
  vatNumber: SELLER.vatNumber,
  contactEmail: "[TO CONFIRM: Shop customer service email address]",
  contactPhone: "[TO CONFIRM: customer service phone number, or remove]",
  contactHours: "[TO CONFIRM: customer service opening hours]",
  returnsAddress: "[TO CONFIRM: address for posted returns]",
  newCavendishAddress: SITE_BUSINESS_ADDRESS_INLINE,
  brunswickAddress: "[TO CONFIRM: full Brunswick Place collection address]",
  ukDeliveryPrice: formatGbpPence(FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery),
  storagePrice: formatGbpPence(FULFILMENT_SURCHARGE_PENCE.lax_storage),
  /** Shown until the order page has a "Report a problem" action. */
  reportProblemNote:
    "[TO CONFIRM: “Report a problem” is not yet on the order page. Remove this route if it is not live at launch]",
} as const;
