import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import {
  type ProfileAddressRow,
  ProfileSettingsBoard,
} from "@/components/dashboard/profile-settings-board";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  describeDashboardSliceFailure,
  describeSettingsActionError,
} from "@/lib/dashboard/dashboard-fetch-errors";
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
  let addresses: ProfileAddressRow[] = [];
  let addressLoadFailure = null;
  const addressRes = await Promise.allSettled([c.addresses.listMine()]);
  if (addressRes[0].status === "fulfilled") {
    addresses = addressRes[0].value;
  } else {
    addressLoadFailure = describeDashboardSliceFailure(
      addressRes[0].reason,
      "addresses",
      "Could not load your addresses.",
    );
  }

  return (
    <DashboardPage className="mx-auto max-w-5xl space-y-8">
      <SettingsFormHeader
        title="Profile"
        description="Manage your personal details, addresses, and account preferences."
      />
      {err ? <DashboardSliceErrorAlert failure={describeSettingsActionError(err)} /> : null}
      {addressLoadFailure ? <DashboardSliceErrorAlert failure={addressLoadFailure} /> : null}
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
