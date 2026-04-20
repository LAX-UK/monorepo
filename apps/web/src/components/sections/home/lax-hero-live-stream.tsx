import type { HeroStateVM } from "@/components/sections/home/home-view-models";
import { LiveIndicatorRow } from "@/components/sections/home/live-indicator";
import { Button } from "@auction/ui/components/button";
import { DisplayHeading, LabelCaps, LiveDot } from "@auction/ui";
import Link from "next/link";

type LiveVm = Extract<HeroStateVM, { kind: "live" }>;

type Props = {
  vm: LiveVm;
  twitchParentHost: string;
};

function iframeSrcFor(vm: LiveVm, twitchParentHost: string): string {
  if (vm.provider !== "twitch") return vm.embedSrc;
  const u = new URL(vm.embedSrc);
  u.searchParams.set("parent", twitchParentHost);
  return u.toString();
}

export function LaxHeroLiveStream({ vm, twitchParentHost }: Props) {
  const iframeSrc = iframeSrcFor(vm, twitchParentHost);

  return (
    <section className="relative w-full bg-hero-cream dark:bg-surface-container-low">
      <div className="relative mx-auto flex min-h-[min(100svh,520px)] w-full max-w-[var(--container-max,1440px)] flex-col md:min-h-[min(100svh,760px)]">
        <div className="relative aspect-video w-full shrink-0 bg-black">
          <iframe
            title={`Live auction: ${vm.saleTitle}`}
            src={iframeSrc}
            className="absolute inset-0 h-full w-full"
            loading="lazy"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div className="relative flex flex-1 flex-col justify-end border-t border-nav-border bg-hero-cream px-6 py-10 md:px-10 dark:border-outline-variant/15 dark:bg-surface-container-low">
          <div className="relative z-[1] flex max-w-[684px] flex-col gap-6">
            <LiveIndicatorRow
              tone="dark"
              progressLabel="Live saleroom"
              saleLine={vm.saleTitle}
              announceUpdates
            />
            <div className="flex flex-col gap-2">
              <LabelCaps className="text-base font-medium leading-6 tracking-normal text-brand-100">
                {vm.modeLabel}
              </LabelCaps>
              <DisplayHeading
                as="h1"
                className="text-3xl font-medium uppercase leading-tight tracking-tight text-hero-foreground md:text-5xl"
              >
                {vm.saleTitle}
              </DisplayHeading>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button variant="liveJoin" size="xl" className="min-h-[44px] w-fit" asChild>
                <Link href={vm.saleroomHref} className="inline-flex items-center justify-center gap-2">
                  <LiveDot className="h-5 w-5" />
                  Open saleroom
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
