import { DashboardPage } from "@/components/dashboard/dashboard-page";
import {
  type ProfileAddressRow,
  ProfileSettingsBoard,
} from "@/components/dashboard/profile-settings-board";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";
import { redirect } from "next/navigation";

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const err = sp.error ? decodeURIComponent(sp.error) : null;

  const meRes = await authedServerFetch("/users/me");
  if (meRes.status === 401) redirect("/login?next=/dashboard/settings/profile&auth=required");
  if (!meRes.ok) redirect("/dashboard?error=profile");

  const meBody = (await meRes.json()) as {
    data: { id: string; email: string; name: string; role: string; image: string | null };
  };
  const me = meBody.data;

  const addrRes = await authedServerFetch("/users/me/addresses");
  const addresses: ProfileAddressRow[] = addrRes.ok
    ? ((await addrRes.json()) as { data: ProfileAddressRow[] }).data
    : [];

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
      <ProfileSettingsBoard initialName={me.name} initialImage={me.image} addresses={addresses} />
    </DashboardPage>
  );
}
