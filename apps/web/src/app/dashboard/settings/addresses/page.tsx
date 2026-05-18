import { AddressesBoard } from "@/components/dashboard/addresses-board";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardErrorAlert } from "@/components/dashboard/primitives";
import type { ProfileAddressRow } from "@/components/dashboard/profile-settings-board";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";

export default async function AddressSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const err = sp.error ? decodeURIComponent(sp.error) : null;

  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/addresses",
  });

  const c = await getServerDataContainer();
  const addresses = await c.addresses.listMine().catch(() => [] as ProfileAddressRow[]);

  return (
    <DashboardPage className="space-y-8">
      <SettingsFormHeader title="Addresses" />
      {err ? <DashboardErrorAlert title="Could not update address" message={err} /> : null}
      <AddressesBoard addresses={addresses} />
    </DashboardPage>
  );
}
