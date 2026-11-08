import { AdminFailedPage } from "@/components/admin-fetch-state";
import { PrintPartiesPanel } from "@/components/settings/print-parties-panel.client";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import type { AdminEffectiveSettings, AdminPrintPartyList } from "@auction/shop-contracts";
import { KeyValueList, PageHeader, Section, StaffButtonLink, StatusBadge } from "@auction/staff-ui";
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
  const [result, parties, session] = await Promise.all([
    fetchAdminJson<AdminEffectiveSettings>("settings/effective"),
    fetchAdminJson<AdminPrintPartyList>("print-parties"),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || parties.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Settings" status={result.status} />;
  }
  const s = result.data;
  const canEditParties =
    session.status === "ok" && session.data.capabilities.includes("settings.write");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="The policies in force on this environment are read-only here; ask the engineering team to change them. The printers and publishers list below is yours to keep."
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
        <Section
          title="Delivery regions"
          description="Lead times and prices by region, and the countries LAX does not deliver to."
          action={
            <StaffButtonLink href="/settings/delivery-regions" variant="secondary" size="sm">
              Open
            </StaffButtonLink>
          }
        >
          <p className="text-staff-sm text-staff-muted">
            Anyone on staff can read them. Changing them needs settings access.
          </p>
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
        {parties.status === "ok" ? (
          <PrintPartiesPanel parties={parties.data.items} canEdit={canEditParties} />
        ) : (
          <Section title="Printers and publishers">
            <p className="text-staff-sm text-staff-muted">
              The list could not be loaded. Reload the page to try again.
            </p>
          </Section>
        )}
      </div>
    </div>
  );
}
