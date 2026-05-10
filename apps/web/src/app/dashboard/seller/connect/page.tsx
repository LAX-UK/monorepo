import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SellerConnectActions } from "./seller-connect-actions";

type ConnectStatus = {
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsCurrentlyDue: string[];
  disabledReason: string | null;
  ready: boolean;
};

export default async function SellerStripeConnectPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/seller/connect",
  });
  const { acting } = await resolveActingContext(user.role);
  if (!acting || acting.kind !== "individual") {
    redirect("/dashboard/seller");
  }

  let status: ConnectStatus | null = null;
  let err: string | null = null;
  const res = await authedServerFetch("/stripe-connect/status");
  if (res.ok) {
    const body = (await res.json()) as { data: ConnectStatus };
    status = body.data;
  } else {
    err = `Could not load Stripe status (${res.status}).`;
  }

  return (
    <div className="screen mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="Stripe Connect"
        description="Complete payout verification so approved lots can be scheduled once finance enables Connect in production."
        className="border-0 pb-0"
      />

      {err ? (
        <p className="font-body text-sm text-error">{err}</p>
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
    </div>
  );
}
