import { ArtGeneralEnquiryPanel } from "@/components/enquiry/art-general-enquiry-panel";
import { artServices } from "@/lib/art-services.server";
import { artStorefrontLoginHref } from "@/lib/art-viewer-state";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
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
    <div className={cn(MARKETING_PAGE_SHELL, "flex max-w-xl flex-col gap-6 py-10")}>
      <header>
        <h1 className="font-headline text-3xl font-semibold text-on-surface">
          Contact the gallery
        </h1>
        <p className="mt-2 text-on-surface-variant">
          Send a general enquiry about viewings, advisory, or selling with LAX Art.
        </p>
      </header>
      <ArtGeneralEnquiryPanel viewer={viewer} loginHref={loginHref} />
    </div>
  );
}
