import { MediaImage } from "@/components/ui/media-image";
import type { HomeLotCard } from "@/lib/home-sections/types";
import { MarketingWorkCard, MarketingWorkGrid } from "@auction/marketing-ui";

function LotCard({ lot }: { lot: HomeLotCard }) {
  return (
    <MarketingWorkCard
      href={lot.href}
      title={lot.title}
      media={
        <MediaImage
          src={lot.imageUrl}
          alt={lot.title}
          label="Lot artwork"
          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
        />
      }
      {...(lot.artistName ? { subtitle: <p className="line-clamp-1">{lot.artistName}</p> } : {})}
      details={lot.details.map((line) => (
        <p key={line} className="line-clamp-1">
          {line}
        </p>
      ))}
      {...(lot.price
        ? {
            footer: (
              <p className="line-clamp-1">
                {lot.price.qualifier ? `${lot.price.qualifier} ` : ""}
                {lot.price.value}
              </p>
            ),
          }
        : {})}
    />
  );
}

/** Lots as the shared work cards. The sections around it say which lots these are. */
export function HomeLotGrid({ lots, label }: { lots: readonly HomeLotCard[]; label: string }) {
  return (
    <MarketingWorkGrid aria-label={label}>
      {lots.map((lot) => (
        <LotCard key={lot.id} lot={lot} />
      ))}
    </MarketingWorkGrid>
  );
}
