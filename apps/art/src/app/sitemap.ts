import { isArtIndexingAllowed, loadArtStorefrontBaseUrl } from "@/env.server";
import { artServices } from "@/lib/art-services.server";
import { loadArtPolicyVisibility } from "@/lib/legal/art-policy-publication.server";
import { composeArtSitemap } from "@/lib/seo/art-sitemap.composer";
import { LAX_ART_POLICIES, LAX_ART_POLICY_ORDER } from "@auction/marketing-ui";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isArtIndexingAllowed()) return [];
  const base = loadArtStorefrontBaseUrl();
  const policyUrl = (path: string) => new URL(path, base).toString();
  const published = LAX_ART_POLICY_ORDER.filter(
    (slug) => loadArtPolicyVisibility(slug) === "published",
  );
  const unpublished = new Set(
    LAX_ART_POLICY_ORDER.filter((slug) => !published.includes(slug)).map((slug) =>
      policyUrl(LAX_ART_POLICIES[slug].artPath),
    ),
  );
  const entries = (await composeArtSitemap(artServices, base)).filter(
    (entry) => !unpublished.has(entry.url),
  );
  const listed = new Set(entries.map((entry) => entry.url));
  // Policies are published from code, so they are listed even without a CMS page.
  for (const url of [
    policyUrl("/legal"),
    ...published.map((slug) => policyUrl(LAX_ART_POLICIES[slug].artPath)),
  ]) {
    if (!listed.has(url)) entries.push({ url, changeFrequency: "yearly", priority: 0.3 });
  }
  return entries;
}
