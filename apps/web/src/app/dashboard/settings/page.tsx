import { SettingsWelcome } from "@/components/dashboard/settings-welcome";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Settings" };

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

  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings",
  });

  const displayName = user.name?.trim() || user.email.split("@")[0] || "there";

  return <SettingsWelcome displayName={displayName} email={user.email} />;
}
