import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { SessionsClientPage } from "@/components/settings/sessions/sessions-client-page";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Active sessions" };

export default async function SessionsPage() {
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/sessions",
  });

  const c = await getServerDataContainer();
  const result = await c.authSessions.listMine();

  if (!result.ok) {
    if (result.error === "unauthorized") {
      redirect("/login?next=/dashboard/settings/sessions&auth=required");
    }
    if (result.error === "suspended") {
      redirect("/login?session_expired=1");
    }
    redirect(`/dashboard?error=sessions&code=${encodeURIComponent(result.error)}`);
  }

  return (
    <DashboardPage className="mx-auto max-w-xl space-y-8">
      <SettingsFormHeader title="Active sessions" />
      <SessionsClientPage sessions={result.sessions} />
    </DashboardPage>
  );
}
