import { lotPath, slugify } from "@/lib/seo/url";
import { appendMarketingParamsToPath } from "@auction/validators";
import { permanentRedirect } from "next/navigation";

/** Sends an old or wrong slug to the lot's canonical address, keeping the marketing parameters. */
export function ensureCanonicalLotSlug(
  slug: string,
  lot: { id: string; title: string },
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  if (slug !== slugify(lot.title)) {
    permanentRedirect(appendMarketingParamsToPath(lotPath(lot), searchParams));
  }
}
