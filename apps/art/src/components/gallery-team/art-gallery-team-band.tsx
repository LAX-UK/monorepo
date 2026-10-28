import { ArtGeneralEnquiryPanel } from "@/components/enquiry/art-general-enquiry-panel";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ArtViewerState } from "@/lib/art-viewer-state";
import type { ArtGalleryTeamVm } from "@/lib/gallery-team/art-gallery-team.vm";
import { MarketingGalleryTeamBand } from "@auction/marketing-ui";

/**
 * The shared gallery team band on lax.art: one primary action into the private enquiry, with the
 * page's topic and subject carried in, then the gallery's direct lines.
 */
export function ArtGalleryTeamBand({
  team,
  viewer,
  className,
}: {
  team: ArtGalleryTeamVm;
  viewer: ArtViewerState;
  className?: string;
}) {
  const { enquiry } = team;
  return (
    <MarketingGalleryTeamBand
      eyebrow={team.eyebrow}
      title={team.title}
      body={team.body}
      note={team.note}
      details={team.details}
      data-testid="art-gallery-team-band"
      {...(className ? { className } : {})}
      media={
        <ArtMediaImage
          src={team.imageUrl}
          alt=""
          sizes="(min-width: 48rem) 40vw, 100vw"
          className="absolute inset-0 size-full"
          imgClassName="object-cover"
        />
      }
      actions={
        // On phones the one action spans the panel, so it is easy to reach with a thumb.
        <div className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-fit">
          <ArtGeneralEnquiryPanel
            viewer={viewer}
            defaultTopic={enquiry.topic}
            triggerLabel={enquiry.label}
            {...(enquiry.subject
              ? { contextSlug: enquiry.subject.slug, contextLabel: enquiry.subject.label }
              : {})}
          />
        </div>
      }
    />
  );
}
