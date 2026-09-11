import Link from "next/link";

export default function ShopSignedOutPage() {
  return (
    <main className="shop-shell">
      <h1 className="text-2xl font-semibold uppercase tracking-tight">Signed out</h1>
      <div className="shop-panel">
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Your Shop session has ended.
        </p>
        <Link href="/login" className="text-link underline-offset-4 hover:underline">
          Sign in again
        </Link>
      </div>
    </main>
  );
}
