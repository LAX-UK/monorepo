import { formatMoney } from "@/lib/format-currency";
import type { Auction } from "@auction/types";
import Image from "next/image";
import Link from "next/link";

function lotLabel(id: string): string {
  return `LOT ${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

type Props = {
  auctions: Auction[];
};

export function HomeMasonry({ auctions }: Props) {
  if (auctions.length === 0) {
    return (
      <section className="mb-32 px-4 md:px-10 lg:px-20">
        <p className="font-body text-on-surface-variant">No auctions to display yet.</p>
      </section>
    );
  }

  const tallOffsets = ["", "lg:mt-32", "", "lg:-mt-16"];

  return (
    <section className="mb-32 px-4 md:px-10 lg:px-20">
      <div className="masonry-layout">
        {auctions.map((a, i) => {
          const img = a.images[0];
          const aspect =
            i % 4 === 0
              ? "aspect-[4/5]"
              : i % 4 === 1
                ? "aspect-[3/4]"
                : i % 4 === 2
                  ? "aspect-square"
                  : "aspect-[4/3]";
          return (
            <div
              key={a.id}
              className={`break-inside-avoid mb-16 group art-card lg:mb-24 ${tallOffsets[i % 4] ?? ""}`}
            >
              <Link href={`/artwork/${a.id}`} className="block">
                <div className={`relative mb-8 overflow-hidden bg-stone-100 ${aspect}`}>
                  {img ? (
                    <Image
                      src={img}
                      alt={a.title}
                      fill
                      className="object-cover transition-transform duration-1000 group-hover:scale-110"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface-container-low text-secondary">
                      No image
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-stone-900/40 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    <span className="bg-white px-8 py-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-stone-900 transition-colors duration-300 hover:bg-primary hover:text-white">
                      View Lot Details
                    </span>
                  </div>
                  <div className="absolute right-6 top-6 mix-blend-difference">
                    <p className="font-label text-[10px] font-bold uppercase tracking-widest text-white">
                      {lotLabel(a.id)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start justify-between pr-4">
                  <div>
                    <p className="mb-3 font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
                      Featured lot
                    </p>
                    <h3 className="mb-3 font-headline text-3xl font-light transition-all duration-300 group-hover:italic">
                      {a.title}
                    </h3>
                    <p className="text-xs font-medium tracking-wide text-stone-500">
                      {a.description?.slice(0, 80) ?? "Curated auction lot"}
                    </p>
                  </div>
                  <p className="font-headline text-2xl text-stone-800">
                    {formatMoney(a.currentPrice)}
                  </p>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
