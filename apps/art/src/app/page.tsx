export default function ArtHomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm uppercase tracking-widest text-neutral-500">lax.art</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Gallery storefront</h1>
      <p className="mt-4 text-lg text-neutral-700">
        Originals and enquiry-led sales share the LAX Art commerce backend with shop.lax.art.
      </p>
      <nav className="mt-8 flex flex-wrap gap-4 text-sm">
        <a href="/artworks" className="underline">
          Artworks
        </a>
        <a href="/account" className="underline">
          Account
        </a>
      </nav>
    </main>
  );
}
