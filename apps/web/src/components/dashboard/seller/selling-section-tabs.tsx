import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { AccountViewTabs } from "@auction/marketing-ui";

const SELLING_PAGES = [
  { id: "consignments", label: "Consignments", href: CLIENT_ROUTES.consignments },
  { id: "payouts", label: "Sold & payouts", href: CLIENT_ROUTES.payouts },
] as const;

export type SellingPage = (typeof SELLING_PAGES)[number]["id"];

/**
 * A personal seller's two Selling pages as views of the one section. An organisation's
 * workspace lists them in its sidebar instead, so it never shows these.
 */
export function SellingSectionTabs({ current }: { current: SellingPage }) {
  return <AccountViewTabs label="Selling" currentId={current} tabs={SELLING_PAGES} />;
}
