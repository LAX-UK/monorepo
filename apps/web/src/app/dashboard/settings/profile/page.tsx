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
import { resolvePhoneDefaultCountry } from "@/lib/phone/resolve-phone-default-country";

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
  const defaultAddress =
    addressRes[0].status === "fulfilled"
      ? (addressRes[0].value.find((a) => a.isDefault) ?? addressRes[0].value[0])
      : undefined;
  const phoneDefaultCountry = await resolvePhoneDefaultCountry(defaultAddress?.country);

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
    <DashboardPage className="space-y-8">
      <SettingsFormHeader
        title="Profile"
        description="Manage your personal details, addresses, and account preferences."
      />
      {err ? <DashboardSliceErrorAlert failure={describeSettingsActionError(err)} /> : null}
      {addressLoadFailure ? <DashboardSliceErrorAlert failure={addressLoadFailure} /> : null}
      <ProfileSettingsBoard
        initialName={me.name}
        initialImage={me.image ?? null}
        initialMobile={me.mobile ?? null}
        initialMobileCountry={me.mobileCountry ?? null}
        phoneDefaultCountry={phoneDefaultCountry}
        addresses={addresses}
        email={me.email}
        {...(me.emailVerified !== undefined ? { emailVerified: me.emailVerified } : {})}
        {...(me.emailStatus !== undefined ? { emailStatus: me.emailStatus } : {})}
      />
    </DashboardPage>
  );
}
