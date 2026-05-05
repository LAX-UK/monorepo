import { AddressesBoard } from "@/components/dashboard/addresses-board";
import type { ProfileAddressRow } from "@/components/dashboard/profile-settings-board";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";
import { redirect } from "next/navigation";

export default async function AddressSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const err = sp.error ? decodeURIComponent(sp.error) : null;
  const res = await authedServerFetch("/users/me/addresses");
  if (res.status === 401) redirect("/login?next=/dashboard/settings/addresses&auth=required");
  const addresses: ProfileAddressRow[] = res.ok
    ? ((await res.json()) as { data: ProfileAddressRow[] }).data
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Addresses"
        description="Manage shipping and billing addresses for your account."
        className="border-b border-outline-variant/20 pb-5"
      />
      {err ? (
        <Alert variant="destructive">
          <AlertTitle>Could not update address</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}
      <AddressesBoard addresses={addresses} />
    </div>
  );
}
