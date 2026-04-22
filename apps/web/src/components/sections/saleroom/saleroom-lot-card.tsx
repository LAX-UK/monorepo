import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SaleLotCardVM } from "./view-models";

type Props = {
  lot: SaleLotCardVM;
  /**
   * OCP: callers slot in Bid / Watch / Results actions without modifying the card.
   * Pass `null` to render the card without actions (e.g. ended sales).
   */
  actions?: ReactNode;
  /** Image sizes hint — defaults to 4-col grid; override for different grids. */
  sizes?: string;
};

const DEFAULT_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw";

function MetaStack({
  label,
  value,
  strongValue,
}: { label: string; value: string; strongValue?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs leading-4 text-[#474747]">{label}</span>
      <span
        className={`text-sm leading-6 text-[#474747] ${strongValue ? "font-semibold text-[#050505]" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}

function MetaInline({ label, value }: { label: string; value: string }) {
  return (
    <p className="whitespace-nowrap text-xs leading-4 text-[#474747]">
      <span>{label} </span>
      <span className="text-sm font-semibold leading-6 text-[#050505]">{value}</span>
    </p>
  );
}

/**
 * Figma saleroom lot tile — no Card chrome; fixed aspect image block.
 */
export function SaleroomLotCard({ lot, actions, sizes = DEFAULT_SIZES }: Props) {
  return (
    <article className="group flex h-full w-full min-w-0 max-w-[320px] flex-col gap-4">
      <Link
        href={lot.href}
        className="relative block aspect-[320/340] w-full min-h-0 overflow-hidden bg-[#0A0A0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={`${lot.lotLabel ? `${lot.lotLabel}: ` : ""}${lot.title}`}
      >
        {lot.imageUrl ? (
          <Image
            src={lot.imageUrl}
            alt={lot.imageAlt}
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-xs text-white/50"
            aria-hidden
          >
            No image
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {lot.lotLabel ? (
          <p className="text-sm font-bold uppercase leading-4 text-[#E17100]">{lot.lotLabel}</p>
        ) : null}
        <div>
          <Link
            href={lot.href}
            className="block text-xl font-semibold leading-6 text-[#050505] hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {lot.title}
          </Link>
          {lot.artistOrMedium ? (
            <p className="mt-1 text-sm font-light leading-4 text-[#191919]">{lot.artistOrMedium}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-start gap-x-8 gap-y-2 text-xs text-[#474747] sm:gap-x-10">
          {lot.estimateValue ? (
            <MetaStack label="Estimate" value={lot.estimateValue} />
          ) : (
            <MetaStack label="Estimate" value="—" />
          )}
          <MetaStack
            label={
              lot.bidsCountLabel
                ? `${lot.currentBidLabel} · ${lot.bidsCountLabel}`
                : lot.currentBidLabel
            }
            value={lot.currentBidValue}
            strongValue
          />
          {lot.closingShort ? <MetaInline label="Closing:" value={lot.closingShort} /> : null}
        </div>
      </div>

      {actions ? <div className="mt-auto w-full min-w-0">{actions}</div> : null}
    </article>
  );
}
