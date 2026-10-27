import { AdminFailedPage } from "@/components/admin-fetch-state";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminEffectiveSettings } from "@auction/shop-contracts";
import { KeyValueList, PageHeader, Section, StatusBadge } from "@auction/staff-ui";
import { redirect } from "next/navigation";

export const metadata = { title: "Settings" };

const NOT_CONFIGURED = "Not configured";

function onOff(value: boolean) {
  return <StatusBadge tone={value ? "success" : "neutral"}>{value ? "On" : "Off"}</StatusBadge>;
}

/** 2000 basis points as "20% (2000 basis points)". */
function vatRate(basisPoints: number | null | undefined): string {
  if (basisPoints === null || basisPoints === undefined) return NOT_CONFIGURED;
  return `${basisPoints / 100}% (${basisPoints} basis points)`;
}

export default async function SettingsPage() {
  const result = await fetchAdminJson<AdminEffectiveSettings>("settings/effective");
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Settings" status={result.status} />;
  }
  const s = result.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="The policies in force on this environment. They are read-only here; ask the engineering team to change them."
      />
      <div className="flex w-full max-w-[720px] flex-col gap-6">
        <Section title="Cancellation and tax">
          <KeyValueList
            items={[
              {
                label: "Cancellation window",
                value:
                  s.cancellationDaysAfterPossession === null ||
                  s.cancellationDaysAfterPossession === undefined
                    ? NOT_CONFIGURED
                    : `${s.cancellationDaysAfterPossession} days after possession`,
              },
              {
                label: "Personalised goods",
                value: s.personalisedGoodsCancellationExempt
                  ? "Exempt from cancellation"
                  : "Can be cancelled",
              },
              { label: "VAT standard rate", value: vatRate(s.vatStandardRateBp) },
            ]}
          />
        </Section>
        <Section title="Areas switched on">
          <KeyValueList
            items={[
              { label: "Payouts", value: onOff(s.payoutsEnabled) },
              { label: "Products", value: onOff(s.merchandiseEnabled) },
              { label: "Original sales", value: onOff(s.originalsEnabled) },
              { label: "Third-party sales", value: onOff(s.thirdPartyEnabled) },
            ]}
          />
        </Section>
      </div>
    </div>
  );
}
