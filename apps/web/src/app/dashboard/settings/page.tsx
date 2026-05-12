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
import { getServerMyAddresses } from "@/lib/data/http/addresses.server";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import type { LegalEntityStatus } from "@auction/types";
import { PageHeader } from "@auction/ui/components/page-header";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

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

  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings",
  });

  const [meRes, addresses] = await Promise.all([
    authedServerFetch("/users/me", { cache: "no-store" }),
    getServerMyAddresses().catch(() => [] as ProfileAddressRow[]),
  ]);

  if (meRes.status === 401) redirect("/login?next=/dashboard/settings&auth=required");
  if (!meRes.ok) redirect("/dashboard?error=settings");

  const meBody = (await meRes.json()) as {
    data: {
      name: string;
      image: string | null;
      email: string;
      emailStatus?: string;
      emailVerified?: boolean;
      pendingNewEmail?: string | null;
      deletionRequestedAt?: string | null;
      twoFactorEnabled?: boolean;
    };
  };
  const me = meBody.data;

  const leRes = await authedServerFetch("/legal-entities/me", { cache: "no-store" });
  const organisations =
    leRes.ok && leRes.status === 200
      ? ((
          (await leRes.json()) as {
            data?: Array<{
              id: string;
              displayName: string;
              kind: string;
              status: LegalEntityStatus;
            }>;
          }
        ).data?.filter((m) => m.kind === "organisation") ?? [])
      : [];

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
          initialImage={me.image}
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
          organisations={organisations}
          emailChanged={sp.changed === "1"}
          linkedProvider={linkedProvider}
          passwordJustSet={passwordJustSet}
        />
      )}
    </DashboardPage>
  );
}
