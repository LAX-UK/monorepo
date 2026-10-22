import { ArtGeneralEnquiryPanel } from "@/components/enquiry/art-general-enquiry-panel";
import type { ArtViewerState } from "@/lib/art-viewer-state";

/** "Book a private viewing" call to action shared by the Visit index and venue pages. */
export function ArtPrivateViewingSection({
  viewer,
  venue,
}: {
  viewer: ArtViewerState;
  venue?: { slug: string; name: string };
}) {
  return (
    <section
      aria-labelledby="visit-enquire-title"
      className="flex max-w-3xl flex-col gap-3 border-t border-border-hairline pt-8"
    >
      <h2 id="visit-enquire-title" className="font-headline text-xl font-semibold text-on-surface">
        Book a private viewing
      </h2>
      <p className="text-on-surface-variant">
        Tell us what you would like to see and the gallery team will arrange a time.
      </p>
      <ArtGeneralEnquiryPanel
        viewer={viewer}
        defaultTopic="private_viewing"
        triggerLabel="Request a viewing"
        {...(venue ? { contextSlug: venue.slug, contextLabel: venue.name } : {})}
      />
    </section>
  );
}
