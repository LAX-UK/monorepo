import { AdminFailedPage } from "@/components/admin-fetch-state";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminEffectiveSettings } from "@auction/shop-contracts";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

export const metadata = { title: "Settings" };

function yesNo(value: boolean): string {
  return value ? "on" : "off";
}

export default async function SettingsPage() {
  const result = await fetchAdminJson<AdminEffectiveSettings>("settings/effective");
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Settings" status={result.status} />;
  }
  const s = result.data;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="The policies in force on this environment. They are read-only here; ask the engineering team to change them."
      />
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
          <dt className="text-on-surface-variant">VAT standard rate (basis points)</dt>
          <dd className="font-medium">{s.vatStandardRateBp ?? "not configured"}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Areas switched on</dt>
          <dd className="font-medium">
            Payouts {yesNo(s.payoutsEnabled)}, products {yesNo(s.merchandiseEnabled)}, original
            sales {yesNo(s.originalsEnabled)}, third-party sales {yesNo(s.thirdPartyEnabled)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
