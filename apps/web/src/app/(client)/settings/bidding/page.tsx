import { bidSettingsHref } from "@/lib/navigation/settings-links";
import { redirect } from "next/navigation";

/** Bidding preferences now live on the one Bid settings page; older links open it at that section. */
export default function BiddingSettingsPage() {
  redirect(bidSettingsHref("bidding"));
}
