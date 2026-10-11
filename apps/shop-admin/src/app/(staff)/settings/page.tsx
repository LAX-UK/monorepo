import { AdminFetchState } from "@/components/admin-fetch-state";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminEffectiveSettings } from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const result = await fetchAdminJson<AdminEffectiveSettings>("settings/effective");
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }
  const s = result.data;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Effective settings</h1>
      <p className="mb-4 text-sm text-on-surface-variant">
        Read-only view of policy env vars in effect on this environment. Change via infra / env, not
        this UI.
      </p>
      <dl className="grid max-w-lg gap-3 text-sm">
        <div>
          <dt className="text-on-surface-variant">Cancellation days after possession</dt>
          <dd className="font-medium">{s.cancellationDaysAfterPossession ?? "not configured"}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Personalised goods cancellation exempt</dt>
          <dd className="font-medium">{s.personalisedGoodsCancellationExempt ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">VAT standard rate (bp)</dt>
          <dd className="font-medium">{s.vatStandardRateBp ?? "not configured"}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Feature flags</dt>
          <dd className="font-medium">
            payouts {String(s.payoutsEnabled)}, merchandise {String(s.merchandiseEnabled)},
            originals {String(s.originalsEnabled)}, third party {String(s.thirdPartyEnabled)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
