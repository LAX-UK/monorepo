import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ExhibitionRevealVm } from "@/lib/editorial/exhibition-page.vm";
import { MarketingRevealCarousel } from "@auction/marketing-ui";

/** Featured current and upcoming shows as the split-slide hero (Figma Reveal, `561:7003`). */
export function ArtExhibitionReveal({ items }: { items: readonly ExhibitionRevealVm[] }) {
  return (
    <MarketingRevealCarousel
      ariaLabel="Featured exhibitions"
      slides={items.map((item, index) => ({
        key: item.key,
        eyebrow: item.eyebrow,
        meta: item.meta,
        title: item.title,
        summary: item.summary,
        cta: { href: item.href, label: "View exhibition" },
        media: (
          <ArtMediaImage
            src={item.imageUrl}
            alt=""
            label="Exhibition"
            sizes="(min-width: 48rem) 45vw, 100vw"
            priority={index === 0}
            className="absolute inset-0 size-full"
            imgClassName="object-cover"
          />
        ),
      }))}
    />
  );
}
