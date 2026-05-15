import { DashboardPage } from "@/components/dashboard/dashboard-page";
import {
  type ProfileAddressRow,
  ProfileSettingsBoard,
} from "@/components/dashboard/profile-settings-board";
import { SettingsSecurityTabContent } from "@/components/dashboard/settings-security-tab-content";
import {
  type SettingsMainTab,
  SettingsUnderlineTabs,
} from "@/components/dashboard/settings-underline-tabs";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { PageHeader } from "@auction/ui/components/page-header";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

function parseTab(raw: string | undefined): SettingsMainTab {
  return raw === "security" ? "security" : "profile";
}

export default async function SettingsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    changed?: string;
    linked?: string;
    password?: string;
  }>;
}) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const linkedProvider: "google" | "apple" | null =
    sp.linked === "google" || sp.linked === "apple" ? sp.linked : null;
  const passwordJustSet = sp.password === "set";

  const me = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings",
  });

  const c = await getServerDataContainer();
  const addresses = await c.addresses.listMine().catch(() => [] as ProfileAddressRow[]);

  const deletionRequestedAt = me.deletionRequestedAt ? new Date(me.deletionRequestedAt) : null;

  return (
    <DashboardPage className="space-y-8">
      <PageHeader
        title="Account settings"
        description="Manage your profile, security, and how we reach you."
        className="border-0 pb-0"
      />

      <SettingsUnderlineTabs active={tab} />

      {tab === "profile" ? (
        <ProfileSettingsBoard
          initialName={me.name}
          initialImage={me.image ?? null}
          addresses={addresses}
          email={me.email}
          {...(me.emailVerified !== undefined ? { emailVerified: me.emailVerified } : {})}
          {...(me.emailStatus !== undefined ? { emailStatus: me.emailStatus } : {})}
        />
      ) : (
        <SettingsSecurityTabContent
          user={{
            email: me.email,
            ...(me.emailStatus !== undefined ? { emailStatus: me.emailStatus } : {}),
            ...(me.emailVerified !== undefined ? { emailVerified: me.emailVerified } : {}),
            ...(me.twoFactorEnabled !== undefined ? { twoFactorEnabled: me.twoFactorEnabled } : {}),
          }}
          hasPendingEmailChange={Boolean(me.pendingNewEmail)}
          deletionRequestedAt={deletionRequestedAt}
          emailChanged={sp.changed === "1"}
          linkedProvider={linkedProvider}
          passwordJustSet={passwordJustSet}
        />
      )}
    </DashboardPage>
  );
}
