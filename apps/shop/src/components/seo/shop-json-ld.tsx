import { type JsonLd, jsonLdScript } from "@auction/branding";

export function ShopJsonLd({ data }: { data: readonly JsonLd[] }) {
  if (data.length === 0) return null;
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLdScript escapes `<`.
      dangerouslySetInnerHTML={{ __html: jsonLdScript(...data) }}
    />
  );
}
