import { ArtEnquirySheet } from "@/components/enquiry/art-enquiry-sheet.client";
import type { ArtworkEnquiryVm } from "@/lib/artwork/artwork-detail-page.composer";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import type { ReactNode } from "react";

export type ArtEnquiryPanelProps = {
  slug: string;
  title: string;
  enquiry: ArtworkEnquiryVm;
  /** Text for the enquiry sheet trigger; the sheet defaults to "Enquire". */
  triggerLabel?: ReactNode;
};

export function ArtEnquiryPanel({ slug, title, enquiry, triggerLabel }: ArtEnquiryPanelProps) {
  switch (enquiry.kind) {
    case "ready":
      return (
        <ArtEnquirySheet
          artworkSlug={slug}
          artworkTitle={title}
          artistName={enquiry.artistName}
          imageUrl={enquiry.imageUrl}
          contact={enquiry.contact}
          autoOpen={enquiry.autoOpen}
          confirmation={enquiry.confirmation}
          {...(triggerLabel ? { triggerLabel } : {})}
        />
      );
    case "account_unavailable":
      return (
        <Alert variant="warning">
          <AlertDescription>{enquiry.message}</AlertDescription>
        </Alert>
      );
    case "unavailable":
      return (
        <p className="text-sm text-on-surface-variant">
          This work has found a home and is no longer available for enquiries.
        </p>
      );
  }
}
