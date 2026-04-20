import { LegalPage } from "@/components/marketing/legal-page";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForStatic({
  title: "Contact",
  description:
    "Contact LAX London Auction House Ltd — concierge, specialist inquiries, and support.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <LegalPage title="Contact">
      <p>
        Concierge:{" "}
        <a
          href="mailto:concierge@example.com"
          className="text-primary underline-offset-4 hover:underline"
        >
          concierge@example.com
        </a>
      </p>
      <p>Telephone: +1 (212) 555-0142 (weekdays, 9am–6pm ET)</p>
      <p className="text-on-surface-variant">
        For bidding support during live phases, signed-in collectors can reach us through their
        dashboard notifications channel.
      </p>
    </LegalPage>
  );
}
