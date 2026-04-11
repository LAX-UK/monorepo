import { formatMoney } from "@/lib/format-currency";
import type { Auction } from "@auction/types";
import Image from "next/image";
import Link from "next/link";

type Props = {
  auctions: Auction[];
  currentId: string;
};

export function RelatedLots({ auctions, currentId }: Props) {
  const related = auctions.filter((a) => a.id !== currentId).slice(0, 6);
  if (related.length === 0) return null;

  return (
    <section className="mt-24 border-t border-outline-variant/15 pt-16">
      <h2 className="mb-10 font-headline text-2xl tracking-tight text-on-surface md:text-3xl">
        Related acquisitions
      </h2>
      <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((a) => {
          const img = a.images[0];
          return (
            <li key={a.id}>
              <Link
                href={`/artwork/${a.id}`}
                className="group block overflow-hidden rounded-lg bg-surface-container-low ring-1 ring-outline-variant/10 transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[4/3] bg-surface-container-low">
                  {img ? (
                    <Image
                      src={img}
                      alt=""
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : null}
                </div>
                <div className="p-4">
                  <h3 className="font-headline text-lg font-light text-on-surface group-hover:italic">
                    {a.title}
                  </h3>
                  <p className="mt-2 font-label text-[10px] uppercase tracking-widest text-primary">
                    {formatMoney(a.currentPrice)}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
