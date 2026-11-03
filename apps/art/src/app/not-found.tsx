import { MarketingNotFound } from "@auction/marketing-ui";
import Link from "next/link";

export default function ArtNotFound() {
  return (
    <MarketingNotFound
      Link={Link}
      illustration="ticket"
      title="We can’t find that page"
      description="The link may be mistyped, or the work may no longer be listed. Search for it, or browse the artworks."
      search={{ action: "/search", label: "Search artworks and artists" }}
      links={[
        { href: "/artworks", label: "Browse artworks" },
        { href: "/artists", label: "See the artists" },
        { href: "/contact", label: "Contact us" },
      ]}
    />
  );
}
