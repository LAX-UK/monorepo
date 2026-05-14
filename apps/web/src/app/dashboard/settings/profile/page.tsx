import { DashboardPage } from "@/components/dashboard/dashboard-page";
import {
  type ProfileAddressRow,
  ProfileSettingsBoard,
} from "@/components/dashboard/profile-settings-board";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";

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
      <PageHeader
        title="Profile"
        description="Manage your personal details, addresses, and account preferences."
        className="border-b border-outline-variant/20 pb-5"
      />
      {err ? (
        <Alert variant="destructive" className="rounded-xl border-error/40 shadow-sm">
          <AlertTitle>Could not update</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}
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
