import type { LotSummarySeedVM } from "@/components/sections/artwork/artwork-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

function sellerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

type Props = {
  seed: LotSummarySeedVM;
  children: ReactNode;
};

/** Figma: kicker (optional) + title; children = info stack + bid region.
 */
export function LotRightSummary({ seed, children }: Props) {
  const av = seed.sellerImageUrl?.trim();
  return (
    <div className="flex w-full max-w-[480px] flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        {seed.kicker ? (
          <p className="text-base leading-4 text-on-surface dark:text-brand-500">{seed.kicker}</p>
        ) : null}
        <h1
          id="lot-heading"
          className="text-3xl font-semibold leading-tight text-on-surface dark:text-on-surface"
        >
          {seed.title}
        </h1>
        <div className="flex min-w-0 items-center gap-2">
          <MediaImage
            src={av}
            alt=""
            label={sellerInitials(seed.sellerName)}
            shape="circle"
            sizes="20px"
            className="size-5 shrink-0"
          />
          <div className="min-w-0 flex flex-1 items-center gap-2">
            <Link
              href={seed.sellerHref}
              className="min-w-0 truncate border-b border-transparent text-base font-medium text-on-surface transition-colors hover:border-primary hover:text-primary dark:text-brand-500"
            >
              {seed.sellerName}
            </Link>
            <span className="shrink-0 rounded-sm bg-surface-container-high px-1.5 py-0.5 font-label text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Verified
            </span>
          </div>
          <Link
            href={seed.sellerHref}
            className="shrink-0 text-primary"
            aria-label="View portfolio"
          >
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
