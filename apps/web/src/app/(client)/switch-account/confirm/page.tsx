import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AccountsUnavailable } from "@/components/layout/account-switcher/accounts-unavailable";
import { SwitchConfirmation } from "@/components/layout/account-switcher/switch-confirmation";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { planSwitchForBrowser } from "@/lib/legal-entity/switch-hop.server";
import { confirmSwitchHref, safeHopNext } from "@/lib/navigation/account-link";
import { buildSwitchConfirmation } from "@/lib/navigation/switch-confirmation.vm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Switch account" };

type SearchParams = { to?: string | string[]; next?: string | string[] };

function first(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/**
 * `/switch-account/confirm?to=<account>&next=<page>`: where a link from another site lands when
 * it would change the account in use. Nothing changes until the person presses "Continue as …".
 */
export default async function SwitchAccountConfirmPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const to = first(params.to);
  const next = safeHopNext(first(params.next));
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: to ? confirmSwitchHref(to, next) : next,
  });

  const outcome = await planSwitchForBrowser(to, next);
  if (outcome.kind === "unavailable") {
    return (
      <DashboardPage>
        <AccountsUnavailable
          retry={{ kind: "link", href: to ? confirmSwitchHref(to, next) : next }}
        />
      </DashboardPage>
    );
  }
  // Already in that account, or not one the person may use: nothing to confirm.
  if (!outcome.plan.switchTo || !outcome.requested) redirect(outcome.plan.redirect);

  return (
    <DashboardPage>
      <SwitchConfirmation
        confirmation={buildSwitchConfirmation({
          requested: outcome.requested,
          current: outcome.current,
          personName: user.name.trim() || user.email,
        })}
        accountId={outcome.requested.id}
        next={next}
      />
    </DashboardPage>
  );
}
