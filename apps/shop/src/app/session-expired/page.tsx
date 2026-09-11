import Link from "next/link";

export default function ShopSessionExpiredPage() {
  return (
    <main className="shop-shell">
      <h1 className="text-2xl font-semibold uppercase tracking-tight">Session expired</h1>
      <div className="shop-panel">
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Your Shop session timed out. Sign in again to continue.
        </p>
        <Link href="/login" className="text-link underline-offset-4 hover:underline">
          Sign in
        </Link>
      </div>
    </main>
  );
}
