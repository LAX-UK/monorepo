import { LotCountdownChip } from "@/components/sections/home/lot-countdown-chip";
import { formatMoney } from "@/lib/format-currency";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import type { Auction, AuctionStatus } from "@auction/types";
import Image from "next/image";
import Link from "next/link";

function lotLabel(id: string): string {
  return `LOT ${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function statusBadge(status: AuctionStatus): { label: string; className: string } {
  switch (status) {
    case "active":
      return { label: "Live", className: "text-primary" };
    case "scheduled":
      return { label: "Upcoming", className: "text-secondary" };
    case "ended":
      return { label: "Ended", className: "text-on-surface-variant" };
    case "draft":
      return { label: "Draft", className: "text-on-surface-variant" };
    case "cancelled":
      return { label: "Cancelled", className: "text-error" };
    default:
      return { label: status, className: "text-secondary" };
  }
}

function endsLabel(end: Date): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffMs = end.getTime() - Date.now();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (Math.abs(diffDays) >= 1) {
    return rtf.format(diffDays, "day");
  }
  const diffHours = Math.round(diffMs / 3_600_000);
  return rtf.format(diffHours, "hour");
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
          const badge = statusBadge(a.status);
          return (
            <div
              key={a.id}
              className={`break-inside-avoid mb-16 group art-card lg:mb-24 ${tallOffsets[i % 4] ?? ""}`}
            >
              <Link href={`/artwork/${a.id}`} className="block">
                <div className={`relative mb-8 overflow-hidden bg-surface-container-low ${aspect}`}>
                  {img ? (
                    <Image
                      src={img}
                      alt={a.title}
                      fill
                      placeholder="blur"
                      blurDataURL={TINY_IMAGE_BLUR}
                      className="object-cover transition-transform duration-1000 group-hover:scale-110"
                      sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface-container-low text-secondary">
                      No image
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-inverse-surface/40 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    <span className="bg-surface-container-lowest px-8 py-3 font-label text-xs font-bold uppercase tracking-[0.2em] text-on-surface transition-colors duration-300 hover:bg-primary hover:text-on-primary">
                      View lot details
                    </span>
                  </div>
                  <div className="absolute right-6 top-6 mix-blend-difference">
                    <p className="font-label text-xs font-bold uppercase tracking-widest text-white">
                      {lotLabel(a.id)}
                    </p>
                  </div>
                  {a.status === "active" ? (
                    <div className="absolute bottom-4 left-4">
                      <LotCountdownChip endTime={a.endTime} />
                    </div>
                  ) : null}
                </div>
                <div className="flex items-start justify-between gap-4 pr-4">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`mb-3 font-label text-xs font-bold uppercase tracking-[0.3em] ${badge.className}`}
                    >
                      {badge.label}
                    </p>
                    <h3 className="mb-3 font-headline text-3xl font-light transition-all duration-300 group-hover:italic">
                      {a.title}
                    </h3>
                    <p className="text-xs font-medium tracking-wide text-on-surface-variant">
                      {a.description?.slice(0, 80) ?? "Curated auction lot"}
                    </p>
                    <p className="mt-2 font-label text-xs uppercase tracking-widest text-secondary">
                      Ends {endsLabel(a.endTime)}
                    </p>
                  </div>
                  <p className="shrink-0 font-headline text-2xl text-on-surface">
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
