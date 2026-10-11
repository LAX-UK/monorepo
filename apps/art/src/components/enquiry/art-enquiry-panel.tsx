import { ArtAuthLink } from "@/components/art-auth-link";
import { ArtEnquirySheet } from "@/components/enquiry/art-enquiry-sheet.client";
import type { ArtworkEnquiryVm } from "@/lib/artwork/artwork-detail-page.composer";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";

export type ArtEnquiryPanelProps = {
  slug: string;
  title: string;
  enquiry: ArtworkEnquiryVm;
  loginHref: string;
};

export function ArtEnquiryPanel({ slug, title, enquiry, loginHref }: ArtEnquiryPanelProps) {
  switch (enquiry.kind) {
    case "ready":
      return (
        <ArtEnquirySheet
          artworkSlug={slug}
          artworkTitle={title}
          contact={enquiry.contact}
          autoOpen={enquiry.autoOpen}
          loginHref={loginHref}
        />
      );
    case "sign_in":
      return (
        <Button asChild size="lg" className="min-h-11 w-full font-label uppercase sm:w-auto">
          <ArtAuthLink href={enquiry.loginHref} data-testid="art-enquire-sign-in">
            Sign in to enquire
          </ArtAuthLink>
        </Button>
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
