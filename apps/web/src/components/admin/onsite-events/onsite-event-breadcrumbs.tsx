import {
  type CatalogBreadcrumbSegment,
  CatalogBreadcrumbs,
} from "@/components/admin/catalog/catalog-breadcrumbs";

type Props = {
  slug?: string;
  eventTitle?: string;
  current?: "rsvps" | "check-in";
};

export function OnsiteEventBreadcrumbs({ slug, eventTitle, current }: Props) {
  const segments: CatalogBreadcrumbSegment[] = [
    { label: "Onsite events", href: "/admin/onsite-events" },
  ];

  if (slug && eventTitle) {
    const rsvpHref =
      current === "check-in"
        ? `/admin/onsite-events/${encodeURIComponent(slug)}?from=check-in`
        : undefined;
    segments.push(rsvpHref ? { label: eventTitle, href: rsvpHref } : { label: eventTitle });
  }

  if (current === "check-in") {
    segments.push({ label: "Check-in" });
  }

  return <CatalogBreadcrumbs segments={segments} />;
}
