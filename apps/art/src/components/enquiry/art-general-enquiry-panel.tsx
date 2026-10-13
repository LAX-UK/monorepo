import { ArtAuthLink } from "@/components/art-auth-link";
import { ArtGeneralEnquirySheet } from "@/components/enquiry/art-general-enquiry-sheet.client";
import type { ArtViewerState } from "@/lib/art-viewer-state";
import type { ArtGeneralEnquiryTopic } from "@/lib/enquiry/submit-general-enquiry";
import { SITE_SUPPORT_EMAIL } from "@auction/branding";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";

type Props = {
  viewer: ArtViewerState;
  loginHref: string;
  defaultTopic?: ArtGeneralEnquiryTopic;
  contextSlug?: string | null;
  contextLabel?: string | null;
  triggerLabel?: string;
};

export function ArtGeneralEnquiryPanel({
  viewer,
  loginHref,
  defaultTopic,
  contextSlug,
  contextLabel,
  triggerLabel,
}: Props) {
  switch (viewer.kind) {
    case "authenticated":
      return (
        <ArtGeneralEnquirySheet
          loginHref={loginHref}
          {...(defaultTopic ? { defaultTopic } : {})}
          {...(contextSlug ? { contextSlug } : {})}
          {...(contextLabel ? { contextLabel } : {})}
          {...(triggerLabel ? { triggerLabel } : {})}
        />
      );
    case "guest":
      return (
        <Button asChild size="lg" className="min-h-11 w-fit font-label uppercase">
          <ArtAuthLink href={loginHref} data-testid="art-general-enquire-sign-in">
            Sign in to contact us
          </ArtAuthLink>
        </Button>
      );
    case "disabled":
      return (
        <Alert variant="warning">
          <AlertDescription>{viewer.message}</AlertDescription>
        </Alert>
      );
    case "unavailable":
      return (
        <Alert variant="warning">
          <AlertDescription>
            {viewer.message} You can also email{" "}
            <a
              href={`mailto:${SITE_SUPPORT_EMAIL}`}
              className="art-focus-ring font-medium underline underline-offset-2"
            >
              {SITE_SUPPORT_EMAIL}
            </a>
            .
          </AlertDescription>
        </Alert>
      );
  }
}
