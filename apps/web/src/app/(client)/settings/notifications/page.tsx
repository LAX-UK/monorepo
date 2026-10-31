import { bidSettingsHref } from "@/lib/navigation/settings-links";
import { redirect } from "next/navigation";

/** Older links and emails ask for notification settings: they open Bid settings at Alerts. */
export default function NotificationSettingsPage() {
  redirect(bidSettingsHref("alerts"));
}
