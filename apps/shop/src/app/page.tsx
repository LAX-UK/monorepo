import { shopIdentityBaseUrl } from "@/lib/shop-identity.server";
import Link from "next/link";

export default function ShopHomePage() {
  const identityBase = shopIdentityBaseUrl();
  return (
    <main id="main-content" className="shop-shell">
      <p className="text-xs uppercase tracking-[0.35em] text-[var(--color-accent-gold)]">LAX</p>
      <div className="text-center">
        <h1 className="text-2xl font-semibold uppercase tracking-tight">LAX Shop</h1>
        <p className="mt-3 text-sm text-[var(--color-on-surface-variant)]">
          Custom shop staging shell. Commerce features arrive after the Identity milestone.
        </p>
      </div>
      <div className="shop-panel shop-actions">
        <a className="shop-button shop-button-primary" href={`${identityBase}/login`}>
          Sign in
        </a>
        <a className="shop-button shop-button-secondary" href="/register">
          Create account
        </a>
        <Link className="shop-button shop-button-secondary" href="/account">
          Account
        </Link>
      </div>
    </main>
  );
}
