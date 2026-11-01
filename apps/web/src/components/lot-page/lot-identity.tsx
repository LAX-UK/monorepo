import { LotEyebrow } from "@/components/lot-page/lot-eyebrow";
import Link from "next/link";

type Props = {
  lotNumber: number | null;
  title: string;
  artist: { name: string; href: string; lifespan: string | null } | null;
  /** "Oil on canvas · 90 × 120 cm". */
  factsLine: string | null;
};

/**
 * Who made the work and what it is: the lot number and its state, the artist (a link to their
 * page), the title as the largest type on the page, and the catalogue line. Long titles wrap
 * in full.
 */
export function LotIdentity({ lotNumber, title, artist, factsLine }: Props) {
  return (
    <header>
      <LotEyebrow lotNumber={lotNumber} />
      {artist ? (
        <p className="m-0 mt-4 mb-1 text-lax-16 leading-6 font-medium">
          <Link
            href={artist.href}
            className="lax-focus rounded-sm underline-offset-4 hover:underline"
          >
            {artist.name}
          </Link>
          {artist.lifespan ? (
            <span className="ml-1.5 text-lax-14 font-normal text-lax-muted">
              ({artist.lifespan})
            </span>
          ) : null}
        </p>
      ) : null}
      <h1 className="m-0 font-lax-display text-lax-28 leading-9 font-semibold tracking-tight text-lax-fg [overflow-wrap:anywhere]">
        {title}
      </h1>
      {factsLine ? (
        <p className="m-0 mt-2 text-lax-14 leading-5 text-lax-muted">{factsLine}</p>
      ) : null}
    </header>
  );
}
