import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardErrorAlert } from "@/components/dashboard/primitives";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { StripeConnectStatus } from "@/lib/data/http/stripe-connect.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SellerConnectActions } from "./seller-connect-actions";

export default async function SellerStripeConnectPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/seller/connect",
  });
  const { acting } = await resolveActingContext(user.role, user.staffRole ?? null);
  if (!acting || acting.kind !== "individual") {
    redirect("/dashboard/seller");
  }

  const c = await getServerDataContainer();
  const connectRes = await c.stripeConnect.getStatus();

  let status: StripeConnectStatus | null = null;
  let err: string | null = null;
  if (connectRes.ok) {
    status = connectRes.data;
  } else {
    const messages: Record<string, string> = {
      unauthorized: "Your session has expired. Please sign in again.",
      not_connected: "No Stripe Connect account found for this entity.",
      server_error: "Could not load Stripe Connect status. Please try again later.",
    };
    err = messages[connectRes.error] ?? "Could not load Stripe Connect status.";
  }

  return (
    <DashboardPage className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="Stripe Connect"
        description="Complete payout verification so approved lots can be scheduled once finance enables Connect in production."
        className="border-0 pb-0"
      />

      {err ? (
        <DashboardErrorAlert message={err} />
      ) : status ? (
        <div className="space-y-4 rounded-md border border-outline-variant/20 bg-surface-container-low/40 p-6">
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
        </div>
      ) : null}

      <p className="font-body text-xs text-on-surface-variant">
        <Link href="/dashboard/seller" className="text-primary underline">
          Back to seller workspace
        </Link>
      </p>
    </DashboardPage>
  );
}
