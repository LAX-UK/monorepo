import Link from "next/link";

export default function ShopDisabledAccountPage() {
  return (
    <main className="shop-shell">
      <h1 className="text-2xl font-semibold uppercase tracking-tight">Account disabled</h1>
      <div className="shop-panel">
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          This LAX account is disabled. Contact support if you believe this is a mistake.
        </p>
        <Link href="/" className="text-link underline-offset-4 hover:underline">
          Return home
        </Link>
      </div>
    </main>
  );
}
