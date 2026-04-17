import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import { DisplayHeading } from "@/components/ui/typography";
import { createAddressAction, updateProfileNameAction } from "@/lib/actions/profile";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import Link from "next/link";
import { redirect } from "next/navigation";

type Address = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

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
  const addresses: Address[] = addrRes.ok
    ? ((await addrRes.json()) as { data: Address[] }).data
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-12">
      <DisplayHeading as="h1" className="text-3xl">
        Profile
      </DisplayHeading>
      {err ? (
        <p
          className="rounded-md border border-error/30 bg-error/10 px-4 py-2 text-sm text-error"
          role="alert"
        >
          {err}
        </p>
      ) : null}
      <section className="space-y-4 rounded-xl border border-outline-variant/15 p-6 ring-1 ring-outline-variant/10">
        <h2 className="font-label text-xs uppercase tracking-widest text-secondary">Account</h2>
        <p className="font-body text-sm text-on-surface-variant">Signed in as {me.email}</p>
        <form action={updateProfileNameAction} className="space-y-4">
          <div>
            <label
              htmlFor="profile-name"
              className="mb-2 block font-label text-xs uppercase text-on-surface-variant"
            >
              Display name
            </label>
            <UnderlineInput
              id="profile-name"
              name="name"
              defaultValue={me.name}
              required
              className="w-full border-b-2 border-outline-variant/40 py-2"
            />
          </div>
          <Button type="submit" variant="primary">
            Save name
          </Button>
        </form>
        <p className="font-body text-xs text-on-surface-variant">
          <Link
            href="/dashboard/settings/security"
            className="text-primary underline-offset-2 hover:underline"
          >
            Security settings
          </Link>
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-outline-variant/15 p-6 ring-1 ring-outline-variant/10">
        <h2 className="font-label text-xs uppercase tracking-widest text-secondary">
          Saved addresses
        </h2>
        {addresses.length === 0 ? (
          <p className="font-body text-sm text-on-surface-variant">No addresses yet.</p>
        ) : (
          <ul className="space-y-3">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-lg bg-surface-container-low/50 px-4 py-3 text-sm">
                <span className="font-label text-xs uppercase text-primary">{a.label}</span>
                {a.isDefault ? (
                  <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 font-label text-[10px] uppercase text-primary">
                    Default
                  </span>
                ) : null}
                <p className="mt-1 text-on-surface">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}
                </p>
                <p className="text-on-surface-variant">
                  {a.city}
                  {a.state ? `, ${a.state}` : ""} {a.postalCode}, {a.country}
                </p>
              </li>
            ))}
          </ul>
        )}
        <h3 className="pt-4 font-label text-xs uppercase tracking-widest text-secondary">
          Add address
        </h3>
        <form action={createAddressAction} className="grid gap-3 md:grid-cols-2">
          <UnderlineInput
            name="label"
            placeholder="Label (e.g. Home)"
            required
            className="border-b py-2"
          />
          <UnderlineInput
            name="line1"
            placeholder="Address line 1"
            required
            className="border-b py-2"
          />
          <UnderlineInput name="line2" placeholder="Line 2 (optional)" className="border-b py-2" />
          <UnderlineInput name="city" placeholder="City" required className="border-b py-2" />
          <UnderlineInput name="state" placeholder="State / region" className="border-b py-2" />
          <UnderlineInput
            name="postalCode"
            placeholder="Postal code"
            required
            className="border-b py-2"
          />
          <UnderlineInput name="country" placeholder="Country" required className="border-b py-2" />
          <label className="flex items-center gap-2 font-body text-sm text-on-surface md:col-span-2">
            <input type="checkbox" name="isDefault" className="h-4 w-4" />
            Set as default shipping address
          </label>
          <div className="md:col-span-2">
            <Button type="submit" variant="secondary">
              Add address
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
