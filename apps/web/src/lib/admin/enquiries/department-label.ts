import { departmentBySlug } from "@auction/domain";
import { humaniseSlug } from "./enquiries.vm";
import { routingRows } from "./enquiry-routing-rows";

/**
 * A department as staff read it ("Watches & clocks"), never its slug: the name clients choose on
 * the enquiry page, then the department list for one no longer offered, then the slug in words.
 * Resolve it on the server and pass the string to client components, so the department data
 * stays out of the browser bundle.
 */
export function departmentLabel(slug: string): string {
  return (
    routingRows([]).find((row) => row.slug === slug)?.label ??
    departmentBySlug(slug)?.label ??
    humaniseSlug(slug)
  );
}

/** The names for every department a page shows, keyed by slug. */
export function departmentNames(
  slugs: Iterable<string | null | undefined>,
): Record<string, string> {
  const names: Record<string, string> = {};
  for (const slug of slugs) if (slug) names[slug] = departmentLabel(slug);
  return names;
}
