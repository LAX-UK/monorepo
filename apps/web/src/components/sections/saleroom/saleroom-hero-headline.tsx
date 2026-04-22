import { Clock } from "lucide-react";
import { LiveIndicator } from "./saleroom-hero-meta";
import type { SaleHeroVM } from "./view-models";

type Props = {
  hero: SaleHeroVM;
};

/**
 * Date row (date line + status pill) and title; sits above the hero image (Figma 1440).
 */
export function SaleroomHeroHeadline({ hero }: Props) {
  const { statusBadge } = hero;

  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="text-base uppercase leading-4 text-brand-500 dark:text-on-surface-variant">
          {hero.dateLine}
        </p>
        {statusBadge ? (
          statusBadge.kind === "upcoming" ? (
            <span className="inline-flex items-center gap-2.5 text-base leading-4 text-brand-500 dark:text-on-surface-variant">
              <Clock className="size-5 shrink-0" aria-hidden />
              {statusBadge.label}
            </span>
          ) : statusBadge.kind === "live" ? (
            <span className="inline-flex items-center gap-2.5">
              <LiveIndicator />
              <span className="text-base leading-4 text-brand-500 dark:text-on-surface-variant">
                {statusBadge.label}
              </span>
            </span>
          ) : (
            <span className="text-base leading-4 text-on-surface-variant">{statusBadge.label}</span>
          )
        ) : null}
      </div>
      <h1 className="text-2xl font-semibold leading-6 text-brand-900 dark:text-on-surface">
        {hero.title}
      </h1>
    </div>
  );
}
