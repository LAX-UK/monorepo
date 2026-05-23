import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import {
  SellerOrgContextBanner,
  SellerProfileUnavailableAlert,
} from "@/components/dashboard/seller-org-context-banner";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { buildSellerConnectFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { StripeConnectStatus } from "@/lib/data/http/stripe-connect.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { SellerConnectActions } from "./seller-connect-actions";

export default async function SellerStripeConnectPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/seller/connect",
  });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRole ?? null);
  const { sellerEntityId, orgActingSelected, bootstrapFailed } = sellerCtx;

  const c = await getServerDataContainer();
  let status: StripeConnectStatus | null = null;
  let connectFailure = null;
  if (sellerEntityId) {
    const connectRes = await c.stripeConnect.getStatus();
    if (connectRes.ok) {
      status = connectRes.data;
    } else {
      connectFailure = buildSellerConnectFailure(connectRes.error);
      if (connectRes.error === "not_connected") {
        connectFailure = {
          ...connectFailure,
          title: "Stripe Connect not set up",
          message:
            "No Stripe Connect account found for this entity. Start onboarding to receive payouts.",
        };
      }
    }
  }

  return (
    <DashboardPage className="mx-auto max-w-2xl space-y-8">
      <DashboardPageHeader
        meta="Selling"
        title="Stripe Connect"
        description="Complete payout verification so approved lots can be scheduled once finance enables Connect in production."
      />

      {orgActingSelected ? <SellerOrgContextBanner /> : null}
      {!sellerEntityId ? <SellerProfileUnavailableAlert bootstrapFailed={bootstrapFailed} /> : null}

      {connectFailure ? (
        <DashboardSliceErrorAlert failure={connectFailure} />
      ) : status ? (
        <Surface variant="section" padding="md" className="space-y-4">
          <dl className="grid gap-2 font-body text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Account</dt>
              <dd className="text-right font-mono text-xs">{status.stripeAccountId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Charges</dt>
              <dd>{status.chargesEnabled ? "Enabled" : "Not enabled"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Payouts</dt>
              <dd>{status.payoutsEnabled ? "Enabled" : "Not enabled"}</dd>
            </div>
            {status.disabledReason ? (
              <div className="flex flex-col gap-1">
                <dt className="text-on-surface-variant">Stripe</dt>
                <dd className="text-error">{status.disabledReason}</dd>
              </div>
            ) : null}
            {status.requirementsCurrentlyDue.length > 0 ? (
              <div className="flex flex-col gap-1">
                <dt className="text-on-surface-variant">Requirements</dt>
                <dd>
                  <ul className="list-disc pl-5">
                    {status.requirementsCurrentlyDue.map((r) => (
                      <li key={r} className="font-mono text-xs">
                        {r}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
          </dl>

          {status.ready ? (
            <p className="font-body text-sm text-primary">
              Stripe Connect looks ready for payouts.
            </p>
          ) : (
            <SellerConnectActions ready={status.ready} />
          )}
        </Surface>
      ) : null}

      <p className="font-body text-xs text-on-surface-variant">
        <Link href="/dashboard/seller" className="text-primary underline">
          Back to seller workspace
        </Link>
      </p>
    </DashboardPage>
  );
}
