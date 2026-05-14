import type { LotCardVM } from "@/components/sections/home/home-view-models";
import { DisplayHeading, SectionHeader } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { UrgencyLotCard } from "./urgency-lot-card";

export type UrgencySectionVariant = "endingSoon" | "liveNow";

type Props = {
  variant: UrgencySectionVariant;
  items: LotCardVM[];
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath?: string;
};

const COPY = {
  endingSoon: {
    heading: "Ending Soon",
    viewAllHref: "/search?ending=24h",
    headingId: "home-ending-soon-heading",
    srAction: "lots ending in the next 24 hours",
  },
  liveNow: {
    heading: "Live Now",
    viewAllHref: "/search?status=active",
    headingId: "home-live-now-heading",
    srAction: "live lots accepting bids",
  },
} as const;

function UrgencySectionHeader({ variant }: { variant: UrgencySectionVariant }) {
  const c = COPY[variant];
  return (
    <SectionHeader
      heading={
        <DisplayHeading
          as="h2"
          id={c.headingId}
          className="text-[40px] font-semibold leading-[60px] text-[#050505] dark:text-on-surface"
        >
          {c.heading}
        </DisplayHeading>
      }
      action={
        <Button variant="chevron" asChild>
          <Link href={c.viewAllHref} className="inline-flex items-center gap-[11px] py-[18px]">
            <span className="text-center text-base font-semibold leading-6 tracking-[0.05em] text-[#050505] dark:text-on-surface">
              View all
            </span>
            <span className="sr-only"> {c.srAction}</span>
            <ChevronRight className="size-5 shrink-0" aria-hidden />
          </Link>
        </Button>
      }
    />
  );
}

/**
 * Urgency strip after the hero: “Ending Soon” when lots close within 100h, else “Live Now”
 * when any active lots exist. Data shaping lives in `getHomeData`.
 */
export function LaxUrgencySection({
  variant,
  items,
  isAuthenticated,
  watchedLotIds,
  loginNextPath = "/",
}: Props) {
  if (items.length === 0) return null;

  const headingId = COPY[variant].headingId;

  return (
    <section
      aria-labelledby={headingId}
      className="cv-auto mx-auto w-full max-w-[var(--container-max,1440px)] px-8 pt-10 md:px-10 lg:px-14"
    >
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-12">
        <UrgencySectionHeader variant={variant} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:gap-8">
          {items.map((item, index) => (
            <UrgencyLotCard
              key={item.id}
              item={item}
              index={index}
              isAuthenticated={isAuthenticated}
              watchedLotIds={watchedLotIds}
              loginNextPath={loginNextPath}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
