import { ArtGeneralEnquirySheet } from "@/components/enquiry/art-general-enquiry-sheet.client";
import type { ArtViewerState } from "@/lib/art-viewer-state";
import type { ArtGeneralEnquiryTopic } from "@/lib/enquiry/submit-general-enquiry";
import { SITE_SUPPORT_EMAIL } from "@auction/branding";
import { Alert, AlertDescription } from "@auction/ui/components/alert";

type Props = {
  viewer: ArtViewerState;
  defaultTopic?: ArtGeneralEnquiryTopic;
  contextSlug?: string | null;
  contextLabel?: string | null;
  triggerLabel?: string;
  triggerVariant?: "default" | "secondaryOutline";
  triggerClassName?: string;
};

const GUEST_CONTACT = { name: "", email: "", phone: "" };

/** Guests can write to the gallery without an account; signed-in visitors get their details prefilled. */
export function ArtGeneralEnquiryPanel({
  viewer,
  defaultTopic,
  contextSlug,
  contextLabel,
  triggerLabel,
  triggerVariant,
  triggerClassName,
}: Props) {
  switch (viewer.kind) {
    case "authenticated":
    case "guest":
      return (
        <ArtGeneralEnquirySheet
          contact={
            viewer.kind === "authenticated"
              ? {
                  name: viewer.displayName ?? "",
                  email: viewer.email ?? "",
                  phone: viewer.verifiedPhone ?? "",
                }
              : GUEST_CONTACT
          }
          {...(defaultTopic ? { defaultTopic } : {})}
          {...(contextSlug ? { contextSlug } : {})}
          {...(contextLabel ? { contextLabel } : {})}
          {...(triggerLabel ? { triggerLabel } : {})}
          {...(triggerVariant ? { triggerVariant } : {})}
          {...(triggerClassName ? { triggerClassName } : {})}
          viewerKind={viewer.kind}
        />
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
