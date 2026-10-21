import { ArtRail, ArtRailItem } from "@/components/layout/art-rail";
import { ArtMediaImage } from "@/components/media/art-media-image";

type InstallationView = { url: string; caption: string | null };

/** Peek carousel: each slide is narrower than the rail so the next one shows at the edge. */
export function ArtExhibitionInstallationViews({
  views,
  exhibitionTitle,
}: {
  views: readonly InstallationView[];
  exhibitionTitle: string;
}) {
  return (
    <ArtRail id="installation-views-rail" label="Installation views">
      {views.map((view) => (
        <ArtRailItem key={view.url} size="feature">
          <figure className="m-0 flex flex-col gap-2">
            <div className="relative aspect-[3/2] overflow-hidden bg-surface-container">
              <ArtMediaImage
                src={view.url}
                alt={view.caption ?? `Installation view of ${exhibitionTitle}`}
                sizes="(min-width: 48rem) 28rem, 85vw"
                className="absolute inset-0 size-full"
                imgClassName="object-cover"
              />
            </div>
            {view.caption ? (
              <figcaption className="text-sm text-on-surface-variant">{view.caption}</figcaption>
            ) : null}
          </figure>
        </ArtRailItem>
      ))}
    </ArtRail>
  );
}
