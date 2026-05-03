import { OwnerBadge } from "@/components/marketing/owner-badge";
import { formatMoney } from "@/lib/format-currency";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { lotPath } from "@/lib/seo/url";
import type { Lot } from "@auction/types";
import Image from "next/image";
import Link from "next/link";

type Props = {
  auctions: Lot[];
  currentId: string;
  currentUserId?: string | null;
  /** Section heading (e.g. “More from this seller”) */
  heading?: string;
};

export function RelatedLots({
  auctions,
  currentId,
  currentUserId = null,
  heading = "More from this seller",
}: Props) {
  const related = auctions.filter((a) => a.id !== currentId).slice(0, 6);
  if (related.length === 0) return null;

  return (
    <section className="mt-24 border-t border-outline-variant/15 pt-16">
      <h2 className="mb-10 font-headline text-2xl tracking-tight text-on-surface md:text-3xl">
        {heading}
      </h2>
      <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((a) => {
          const img = a.images[0];
          return (
            <li key={a.id}>
              <Link
                href={lotPath(a)}
                className="group block overflow-hidden rounded-lg bg-surface-container-low ring-1 ring-outline-variant/10 transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[4/3] bg-surface-container-low">
                  {img ? (
                    <Image
                      src={img}
                      alt={`${a.title} — related lot`}
                      fill
                      placeholder="blur"
                      blurDataURL={TINY_IMAGE_BLUR}
                      className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : null}
                  <OwnerBadge
                    owned={Boolean(currentUserId && a.sellerId === currentUserId)}
                    className="absolute right-2 top-2"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-headline text-lg font-light text-on-surface group-hover:italic">
                    {a.title}
                  </h3>
                  <p className="mt-2 font-label text-xs uppercase tracking-widest text-primary">
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
