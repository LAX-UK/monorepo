import { AddressesBoard } from "@/components/dashboard/addresses-board";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import type { ProfileAddressRow } from "@/components/dashboard/profile-settings-board";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  describeDashboardSliceFailure,
  describeSettingsActionError,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";

export default async function AddressSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const err = sp.error ? decodeURIComponent(sp.error) : null;
  const returnAfterSave =
    sp.next?.startsWith("/dashboard/") && !sp.next.includes("//") ? sp.next : null;

  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/addresses",
  });

  const c = await getServerDataContainer();
  let addresses: ProfileAddressRow[] = [];
  let loadFailure = null;
  const addressRes = await Promise.allSettled([c.addresses.listMine()]);
  if (addressRes[0].status === "fulfilled") {
    addresses = addressRes[0].value;
  } else {
    loadFailure = describeDashboardSliceFailure(
      addressRes[0].reason,
      "addresses",
      "Could not load your addresses.",
    );
  }

  return (
    <DashboardPage className="space-y-8">
      <SettingsFormHeader title="Addresses" />
      {err ? <DashboardSliceErrorAlert failure={describeSettingsActionError(err)} /> : null}
      {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}
      <AddressesBoard addresses={addresses} {...(returnAfterSave ? { returnAfterSave } : {})} />
    </DashboardPage>
  );
}
