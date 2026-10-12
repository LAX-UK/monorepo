import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import type { VenueFactsVm } from "@/lib/editorial/editorial-pages.composer";
import { cn } from "@auction/ui";

const DETAIL_LINK = "text-link underline underline-offset-4 hover:no-underline art-focus-ring";
const TERM = "font-label text-xs uppercase tracking-widest text-on-surface-variant";

/** Address, opening hours and contact for a venue; `compact` drops contact for list cards. */
export function ArtVenueFacts({
  facts: { venue, hours, addressLine },
  compact = false,
  className,
}: {
  facts: VenueFactsVm;
  compact?: boolean;
  className?: string;
}) {
  const showContact = !compact && (venue.phone || venue.email);
  if (!addressLine && hours.length === 0 && !showContact) return null;
  return (
    <dl className={cn("grid gap-4 text-sm", className)}>
      {addressLine ? (
        <div>
          <dt className={TERM}>Address</dt>
          <dd className="mt-1 text-base text-on-surface">
            <address className="not-italic">{addressLine}</address>
            {!compact && venue.mapUrl ? (
              <ArtEditorialLink href={venue.mapUrl} className={DETAIL_LINK}>
                Get directions
              </ArtEditorialLink>
            ) : null}
          </dd>
        </div>
      ) : null}
      {hours.length > 0 ? (
        <div>
          <dt className={TERM}>Opening hours</dt>
          <dd className="mt-1">
            <ul className="flex flex-col gap-1 text-base text-on-surface">
              {hours.map((row) => (
                <li key={row.label} className="flex justify-between gap-6">
                  <span>{row.label}</span>
                  <span className="text-on-surface-variant">{row.value}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}
      {showContact ? (
        <div>
          <dt className={TERM}>Contact</dt>
          <dd className="mt-1 flex flex-col gap-1 text-base">
            {venue.phone ? (
              <a href={`tel:${venue.phone.replace(/\s+/g, "")}`} className={DETAIL_LINK}>
                {venue.phone}
              </a>
            ) : null}
            {venue.email ? (
              <ArtEditorialLink href={`mailto:${venue.email}`} className={DETAIL_LINK}>
                {venue.email}
              </ArtEditorialLink>
            ) : null}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
