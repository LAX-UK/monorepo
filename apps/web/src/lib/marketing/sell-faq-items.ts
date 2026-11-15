import { faqGroups } from "@/components/marketing/faq/faq-data";
import { SELL_FAQ_IDS } from "@/lib/marketing/sell-landing";

/** The selling questions shown on the selling pages, in the order of SELL_FAQ_IDS. */
export const SELL_FAQ_ITEMS = faqGroups
  .flatMap((group) => (group.id === "selling" ? group.items : []))
  .filter((item) => (SELL_FAQ_IDS as readonly string[]).includes(item.id))
  .sort((a, b) => SELL_FAQ_IDS.indexOf(a.id as never) - SELL_FAQ_IDS.indexOf(b.id as never));
