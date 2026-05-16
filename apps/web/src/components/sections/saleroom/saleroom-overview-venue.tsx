import { ExternalLink } from "lucide-react";
import type { SaleOverviewVM } from "./view-models";

type Props = {
  overview: SaleOverviewVM;
};

/** Physical venue + map link when `showLocation`. */
export function SaleroomOverviewVenue({ overview }: Props) {
  if (!overview.showLocation) return null;

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-lg font-semibold text-on-surface">Venue</h3>
      {overview.locationName ? (
        <p className="text-base leading-6 text-on-surface">{overview.locationName}</p>
      ) : null}
      {overview.locationAddressLines.length > 0 ? (
        <address className="mt-1 text-base not-italic leading-6 text-on-surface-variant">
          {overview.locationAddressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      ) : overview.locationAddress ? (
        <p className="mt-1 whitespace-pre-line text-base leading-6 text-on-surface-variant">
          {overview.locationAddress}
        </p>
      ) : null}
      {overview.resolvedMapUrl ? (
        <p className="mt-2 text-base">
          <a
            href={overview.resolvedMapUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 font-semibold text-on-surface underline underline-offset-2 hover:opacity-80"
          >
            <ExternalLink className="size-4 shrink-0" aria-hidden />
            {overview.locationMapUrl ? "Open map" : "Get directions"}
          </a>
        </p>
      ) : null}
    </div>
  );
}
