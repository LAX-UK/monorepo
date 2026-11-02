import { PRIVATE_SALES_PATH } from "../marketing/private-sales";

/**
 * Where the retired private sales addresses go now. Private sales used to be a calendar tab
 * (`/sales?tab=privatesales`) and a contact form intent (`/contact?intent=private-sale`); both are
 * the enquiry page under Sell. Permanent (301) so links and search results carry over.
 *
 * Plain data with no framework imports, because `next.config.ts` loads it before the app compiles.
 * The tab value is matched in any letter case, as the calendar always read it.
 */
export type PrivateSalesRedirect = {
  source: string;
  has: { type: "query"; key: string; value: string }[];
  destination: string;
  statusCode: 301;
};

export const PRIVATE_SALES_REDIRECTS: readonly PrivateSalesRedirect[] = [
  {
    source: "/sales",
    has: [{ type: "query", key: "tab", value: "[pP][rR][iI][vV][aA][tT][eE][sS][aA][lL][eE][sS]" }],
    destination: PRIVATE_SALES_PATH,
    statusCode: 301,
  },
  {
    source: "/contact",
    has: [{ type: "query", key: "intent", value: "private-sale" }],
    destination: PRIVATE_SALES_PATH,
    statusCode: 301,
  },
];
