import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { SessionsClientPage } from "@/components/settings/sessions/sessions-client-page";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { describeSessionsOverviewError } from "@/lib/dashboard/dashboard-fetch-errors";
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
      redirect("/account-suspended");
    }
    const failure = describeSessionsOverviewError(result.error);
    return (
      <DashboardPage className="space-y-8">
        <SettingsFormHeader title="Active sessions" />
        <DashboardSliceErrorAlert failure={failure} />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage className="space-y-8">
      <SettingsFormHeader title="Active sessions" />
      <SessionsClientPage sessions={result.sessions} />
    </DashboardPage>
  );
}
