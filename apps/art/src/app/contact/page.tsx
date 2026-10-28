import { ArtGalleryTeamBand } from "@/components/gallery-team/art-gallery-team-band";
import { artServices } from "@/lib/art-services.server";
import { buildArtGalleryTeam } from "@/lib/gallery-team/art-gallery-team.vm";
import { GALLERY_CONTACT, MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingPageTitle } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | lax.art",
  description: `Contact the London Art Exchange gallery team: private enquiries, viewings and advice, by phone, email or at ${GALLERY_CONTACT.address}.`,
  alternates: { canonical: "/contact" },
};

/** The gallery's details and the private enquiry, in one place. */
export default async function ArtContactPage() {
  const viewer = await artServices.viewer.load();

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8 pb-10 lg:pb-16")}>
      <MarketingPageTitle title="Contact the gallery" density="compact" />
      <ArtGalleryTeamBand team={buildArtGalleryTeam({ context: "contact" })} viewer={viewer} />
    </div>
  );
}
