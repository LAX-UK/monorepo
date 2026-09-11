import Link from "next/link";

type ShopCallbackPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ShopAuthCallbackPage({ searchParams }: ShopCallbackPageProps) {
  const params = await searchParams;
  if (params.error) {
    return (
      <main className="shop-shell">
        <h1 className="text-2xl font-semibold uppercase tracking-tight">Sign-in failed</h1>
        <div className="shop-panel">
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Shop sign-in could not be completed ({params.error}).
          </p>
          <Link href="/login" className="text-link underline-offset-4 hover:underline">
            Try again
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="shop-shell">
      <h1 className="text-2xl font-semibold uppercase tracking-tight">Signing you in</h1>
      <div className="shop-panel">
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Completing Shop sign-in through the Identity boundary.
        </p>
        <Link href="/account" className="text-link underline-offset-4 hover:underline">
          Continue to account
        </Link>
      </div>
    </main>
  );
}
