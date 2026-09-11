import { shopIdentityBaseUrl } from "@/lib/shop-identity.server";
import Link from "next/link";

type AccountPayload = {
  authenticated?: boolean;
  subject?: string;
  profile?: { email?: string | null; name?: string | null };
  reason?: string;
};

async function loadAccount(): Promise<AccountPayload> {
  const response = await fetch(`${shopIdentityBaseUrl()}/me`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  return (await response.json()) as AccountPayload;
}

export default async function ShopAccountPage() {
  const account = await loadAccount();
  if (!account.authenticated) {
    return (
      <main className="shop-shell">
        <h1 className="text-2xl font-semibold uppercase tracking-tight">Sign in required</h1>
        <div className="shop-panel">
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            {account.reason === "identity_disabled"
              ? "This account is disabled."
              : "Start sign-in through the Shop Identity boundary."}
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
        <form action={`${shopIdentityBaseUrl()}/logout`} method="post" className="mt-4">
          <button type="submit" className="text-link underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
