import { MediaImage } from "@/components/ui/media-image";
import { lotPath } from "@/lib/seo/url";
import type { Lot } from "@auction/types";
import { StatusBadge } from "@auction/ui";
import Link from "next/link";

type Props = {
  lots: Lot[];
};

/** New lots tab — recent catalog lots (`GET /lots` contract). */
export function SalesNewLotsGrid({ lots }: Props) {
  if (lots.length === 0) {
    return (
      <p className="font-body text-sm text-[#474747] dark:text-on-surface-variant">
        No new lots are listed yet. Check back soon.
      </p>
    );
  }

  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {lots.map((lot, index) => (
        <li key={lot.id}>
          <article className="group flex flex-col overflow-hidden rounded-lg border border-[#D1D1D1] bg-white transition-shadow duration-200 motion-safe:hover:shadow-md dark:border-outline-variant/30 dark:bg-surface-container-low/40">
            <Link
              href={lotPath(lot)}
              className="relative aspect-[4/3] w-full overflow-hidden bg-[#E4E4E7] dark:bg-surface-container-low"
            >
              <MediaImage
                src={lot.images[0] ?? null}
                alt={lot.title}
                label="Lot image"
                className="absolute inset-0 size-full"
                imgClassName="size-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                priority={index < 3}
              />
            </Link>
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <StatusBadge variant={lot.status === "active" ? "live" : "neutral"}>
                  {lot.status}
                </StatusBadge>
              </div>
              <Link
                href={lotPath(lot)}
                className="font-body text-base font-semibold leading-snug text-[#050505] underline-offset-2 hover:underline dark:text-on-surface"
              >
                {lot.title}
              </Link>
              {lot.medium ? (
                <p className="line-clamp-2 font-body text-sm text-[#474747] dark:text-on-surface-variant">
                  {lot.medium}
                </p>
              ) : null}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
