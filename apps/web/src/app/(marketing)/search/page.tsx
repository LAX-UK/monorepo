import { getServerAuctionReader } from "@/lib/data/http/auctions.server";
import { formatMoney } from "@/lib/format-currency";
import type { Auction } from "@auction/types";
import Image from "next/image";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

function matchesQuery(a: Auction, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  const t = `${a.title} ${a.description ?? ""}`.toLowerCase();
  return t.includes(n);
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q = "" } = await searchParams;
  const reader = await getServerAuctionReader();
  let auctions: Auction[] = [];
  try {
    auctions = await reader.list({ limit: 60 });
  } catch {
    auctions = [];
  }
  const filtered = q.trim() ? auctions.filter((a) => matchesQuery(a, q)) : auctions.slice(0, 24);

  return (
    <main id="main-content" className="mx-auto max-w-[1920px] px-6 pb-24 pt-28 md:px-16">
      <h1 className="mb-2 font-headline text-4xl tracking-tight text-on-surface">Search</h1>
      <p className="mb-6 font-body text-sm text-on-surface-variant">
        Filter loaded inventory by title or description.
      </p>
      <form action="/search" method="get" className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="search-q" className="mb-2 block font-label text-[10px] uppercase tracking-widest text-secondary">
            Keywords
          </label>
          <input
            id="search-q"
            name="q"
            defaultValue={q}
            placeholder="Title, medium, description…"
            className="w-full border-b-2 border-outline-variant/40 bg-transparent py-3 font-body text-on-surface outline-none transition-colors focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="bg-gradient-to-br from-primary to-primary-container px-8 py-3 font-label text-[10px] font-bold uppercase tracking-[0.3em] text-on-primary shadow-sm transition-opacity hover:opacity-95"
        >
          Search
        </button>
      </form>

      {filtered.length === 0 ? (
        <p className="font-body text-on-surface-variant">No lots match that search.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => {
            const img = a.images[0];
            return (
              <li key={a.id}>
                <Link
                  href={`/artwork/${a.id}`}
                  className="group block overflow-hidden rounded-lg bg-surface-container-low ring-1 ring-outline-variant/10 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="relative aspect-[4/5] bg-surface-container-low">
                    {img ? (
                      <Image
                        src={img}
                        alt=""
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, 33vw"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <h2 className="font-headline text-xl font-light text-on-surface group-hover:italic">
                      {a.title}
                    </h2>
                    <p className="mt-2 font-label text-[10px] uppercase tracking-widest text-primary">
                      {formatMoney(a.currentPrice)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
