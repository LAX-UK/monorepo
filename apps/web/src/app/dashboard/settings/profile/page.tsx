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
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="Profile"
        description="Update your display name and manage shipping addresses."
        className="border-0 pb-0"
      />
      {err ? (
        <Alert variant="destructive">
          <AlertTitle>Could not update</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}
      <ProfileSettingsBoard email={me.email} initialName={me.name} addresses={addresses} />
    </div>
  );
}
