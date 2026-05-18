import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardErrorAlert } from "@/components/dashboard/primitives";
import {
  type ProfileAddressRow,
  ProfileSettingsBoard,
} from "@/components/dashboard/profile-settings-board";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const err = sp.error ? decodeURIComponent(sp.error) : null;

  const me = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/profile",
  });

  const c = await getServerDataContainer();
  const addresses = await c.addresses.listMine().catch(() => [] as ProfileAddressRow[]);

  return (
    <DashboardPage className="mx-auto max-w-5xl space-y-8">
      <SettingsFormHeader
        title="Profile"
        description="Manage your personal details, addresses, and account preferences."
      />
      {err ? <DashboardErrorAlert title="Could not update" message={err} /> : null}
      <ProfileSettingsBoard
        initialName={me.name}
        initialImage={me.image ?? null}
        addresses={addresses}
        email={me.email}
        {...(me.emailVerified !== undefined ? { emailVerified: me.emailVerified } : {})}
        {...(me.emailStatus !== undefined ? { emailStatus: me.emailStatus } : {})}
      />
    </DashboardPage>
  );
}
