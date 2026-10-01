import Link from "next/link";

export default function ShopAdminArtworksPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-on-surface-variant">Shop admin</p>
          <h1 className="text-2xl font-semibold">Artworks</h1>
        </div>
        <Link href="/login" className="text-sm underline">
          Sign in
        </Link>
      </header>
      <p className="text-sm text-on-surface-variant">
        Placeholder catalogue list. Phase 1 wires import and sale authority through{" "}
        <code>shop-api</code> admin routes after staff OIDC exchange.
      </p>
    </main>
  );
}
