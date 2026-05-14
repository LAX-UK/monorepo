import { AddressesBoard } from "@/components/dashboard/addresses-board";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardErrorAlert } from "@/components/dashboard/primitives";
import type { ProfileAddressRow } from "@/components/dashboard/profile-settings-board";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { PageHeader } from "@auction/ui/components/page-header";

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
      <PageHeader
        title="Addresses"
        description="Manage shipping and billing addresses for your account."
        className="border-b border-outline-variant/20 pb-5"
      />
      {err ? <DashboardErrorAlert title="Could not update address" message={err} /> : null}
      <AddressesBoard addresses={addresses} />
    </DashboardPage>
  );
}
