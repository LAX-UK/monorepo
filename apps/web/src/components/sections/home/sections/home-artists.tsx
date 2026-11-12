import { ArtistPortraitFrame } from "@/components/marketing/artist-portrait-frame";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { MediaImage } from "@/components/ui/media-image";
import type { HomeArtistCard } from "@/lib/home-sections/types";
import { MarketingArtistCard } from "@auction/marketing-ui/marketing-artist-card";

/** Artists the house holds work by, as the shared artist card. */
export function HomeArtistsSection({ artists }: { artists: readonly HomeArtistCard[] }) {
  return (
    <MarketingSection
      id="home-artists"
      heading="Artists"
      subtitle="With works on sale or recently sold at LAX Bid"
      action={{ href: "/artists", label: "Browse artists" }}
    >
      <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-7 p-0 md:grid-cols-4 md:gap-x-6">
        {artists.map((artist) => (
          <li key={artist.id} className="min-w-0">
            <MarketingArtistCard
              href={artist.href}
              name={artist.name}
              nameAs="h3"
              facts={artist.facts}
              caption={artist.caption}
              {...(artist.portraitUrl
                ? {
                    portrait: (
                      <ArtistPortraitFrame
                        src={artist.portraitUrl}
                        alt={`Portrait of ${artist.name}`}
                        label="Artist portrait"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    ),
                  }
                : artist.workImageUrl
                  ? {
                      work: (
                        <MediaImage
                          src={artist.workImageUrl}
                          alt=""
                          label="Work by this artist"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      ),
                    }
                  : {})}
            />
          </li>
        ))}
      </ul>
    </MarketingSection>
  );
}
