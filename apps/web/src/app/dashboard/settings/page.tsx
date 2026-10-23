import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Bid settings" };

const FIRST_BID_SETTINGS_PATH = "/dashboard/settings/bidding";

/**
 * There is no settings overview: this index only keeps old links working. Security links
 * from emails (`?tab=security`) still reach the security page they were written for.
 */
export default async function SettingsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    changed?: string;
    linked?: string;
    password?: string;
  }>;
}) {
  const sp = await searchParams;

  if (sp.tab === "security") {
    const q = new URLSearchParams();
    if (sp.changed === "1") q.set("changed", "1");
    if (sp.linked) q.set("linked", sp.linked);
    if (sp.password === "set") q.set("password", "set");
    const suffix = q.toString() ? `?${q.toString()}` : "";
    redirect(`/dashboard/settings/security${suffix}`);
  }

  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings",
  });
  redirect(FIRST_BID_SETTINGS_PATH);
}
