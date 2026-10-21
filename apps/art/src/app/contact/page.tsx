import { ArtGeneralEnquiryPanel } from "@/components/enquiry/art-general-enquiry-panel";
import { artServices } from "@/lib/art-services.server";
import { artStorefrontLoginHref } from "@/lib/art-viewer-state";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingPageTitle } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | LAX Art",
  description: "Contact the London Art Exchange gallery team.",
  alternates: { canonical: "/contact" },
};

export default async function ArtContactPage() {
  const viewer = await artServices.viewer.load();
  const loginHref = artStorefrontLoginHref("/contact");

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-6 pb-10 lg:pb-16")}>
      <MarketingPageTitle
        title="Contact the gallery"
        subtitle="Send a general enquiry about viewings, advisory, or selling with LAX Art."
      />
      <div className="mx-auto flex w-full max-w-xl flex-col">
        <ArtGeneralEnquiryPanel viewer={viewer} loginHref={loginHref} />
      </div>
    </div>
  );
}
