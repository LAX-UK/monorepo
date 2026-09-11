import { shopIdentityCookieHeader, shopIdentityUrl } from "@/lib/shop-identity.server";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

type AccountPayload = {
  authenticated?: boolean;
  subject?: string;
  profile?: { email?: string | null; name?: string | null };
  reason?: string;
};

async function loadAccount(): Promise<AccountPayload> {
  const cookieStore = await cookies();
  const cookieHeader = shopIdentityCookieHeader(cookieStore.getAll());
  const response = await fetch(shopIdentityUrl("/me"), {
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  });
  return (await response.json()) as AccountPayload;
}

export default async function ShopAccountPage() {
  const account = await loadAccount();
  if (!account.authenticated) {
    if (account.reason === "identity_disabled") {
      redirect("/account/disabled");
    }
    return (
      <main className="shop-shell">
        <h1 className="text-2xl font-semibold uppercase tracking-tight">Sign in required</h1>
        <div className="shop-panel">
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Start sign-in through the Shop Identity boundary.
          </p>
          <Link href="/login" className="text-link underline-offset-4 hover:underline">
            Continue to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="shop-shell">
      <h1 className="text-2xl font-semibold uppercase tracking-tight">Your account</h1>
      <div className="shop-panel">
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-[var(--color-on-surface-variant)]">Subject</dt>
            <dd>{account.subject}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-on-surface-variant)]">Email</dt>
            <dd>{account.profile?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-on-surface-variant)]">Name</dt>
            <dd>{account.profile?.name ?? "—"}</dd>
          </div>
        </dl>
        <form action={shopIdentityUrl("/logout")} method="post" className="mt-4">
          <button type="submit" className="text-link underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
