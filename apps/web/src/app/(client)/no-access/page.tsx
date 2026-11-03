import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { NoAccess } from "@/components/layout/account-switcher/no-access";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import { accountHomePathForKind } from "@/lib/navigation/account-home";
import { refusedPageTarget } from "@/lib/navigation/account-link";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { workspaceAccessDenied } from "@/lib/presenters/workspace-access/workspace-access";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "No access" };

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [user, { next: rawNext }] = await Promise.all([
    requireAuthenticatedUser({ shell: "client", loginNext: CLIENT_ROUTES.noAccess }),
    searchParams,
  ]);
  const active = await resolveActiveOrganisationActor(user);
  const next = refusedPageTarget(rawNext);
  // Nothing was refused (a bookmark, a stale link): the account's own first page is the answer.
  if (!next) redirect(accountHomePathForKind(active ? "organisation" : "personal"));
  return (
    <DashboardPage>
      <SetMobileShellTitle title="No access" />
      <NoAccess next={next} denied={workspaceAccessDenied(next, active?.actor ?? null)} />
    </DashboardPage>
  );
}
