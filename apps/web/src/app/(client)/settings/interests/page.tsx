import { bidSettingsHref } from "@/lib/navigation/settings-links";
import { redirect } from "next/navigation";

/** Auction interests now live on the one Bid settings page; older links open it at that section. */
export default function AuctionInterestsSettingsPage() {
  redirect(bidSettingsHref("interests"));
}
