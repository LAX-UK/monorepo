import { AccountShell } from "@/components/account-shell";
import { AccountUnavailable } from "@/components/account-unavailable";
import { AlertsContent } from "@/components/alerts-content";
import { loadAccountSession } from "@/server/application/load-account-session";
import { loadAlertPreferences } from "@/server/application/load-alert-preferences";
import { getLaxAccountContainer } from "@/server/container";
import { buildAlertsPage } from "@/server/domain/account-alerts.vm";
import { buildAccountLinks } from "@/server/domain/account-links";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Email alerts · LAX Account" };

/**
 * Every product's alert emails in one place: LAX Bid, LAX Shop and lax.art. Each product answers
 * for itself, so one being down never hides the others.
 */
export default async function AlertsPage() {
  const session = await loadAccountSession();
  if (session.status === "unavailable")
    return <AccountUnavailable retryHref={ACCOUNT_ROUTES.alerts} />;
  if (session.status !== "ok") redirect(`/api/auth/login?returnTo=${ACCOUNT_ROUTES.alerts}`);
  const reads = await loadAlertPreferences();
  if (!reads) redirect(`/api/auth/login?returnTo=${ACCOUNT_ROUTES.alerts}`);

  const { config } = getLaxAccountContainer();
  const links = buildAccountLinks(config, { email: session.overview.email });
  const page = buildAlertsPage({
    reads,
    email: session.overview.email,
    emailVerified: session.overview.emailVerified,
    links: {
      bidSettings: links.bidSettings?.notifications ?? null,
      shopWaiting: config.shopPublicUrl ? `${config.shopPublicUrl}/account/orders` : null,
      verifyEmail: links.verifyEmail,
    },
  });

  return (
    <AccountShell>
      <AlertsContent page={page} />
    </AccountShell>
  );
}
