import { DeferredLiveIframe } from "@/components/marketing/deferred-live-iframe";
import type { HeroStateVM } from "@/components/sections/home/home-view-models";
import { LaxHeroLiveOverlayContent } from "@/components/sections/home/lax-hero-live-overlay-content";
import { LiveIndicatorRow } from "@/components/sections/home/live-indicator";
import { HeroAdaptiveShell } from "@/components/ui/hero-adaptive-shell";
import { HeroHorizontalScrim } from "@/components/ui/hero-tone-scrim";
import { RevealOnMount } from "@/components/ui/reveal";
import { HOME_HERO_MIN_H } from "@/lib/marketing/home-hero-layout";
import { DisplayHeading, LabelCaps, LiveDot } from "@auction/ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type LiveVm = Extract<HeroStateVM, { kind: "live" }>;

type Props = {
  vm: LiveVm;
};

/** Background-style YouTube embed: autoplay muted, minimal chrome, optional start offset. */
function youtubeHeroBackgroundSrc(videoId: string, startSeconds: number | undefined): string {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    modestbranding: "1",
    playsinline: "1",
    rel: "0",
    iv_load_policy: "3",
    loop: "1",
    playlist: videoId,
    disablekb: "1",
    fs: "0",
  });
  if (startSeconds !== undefined && startSeconds > 0) {
    params.set("start", String(startSeconds));
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function watchOnYoutubeUrl(videoId: string, startSeconds: number | undefined): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  if (startSeconds !== undefined && startSeconds > 0) {
    return `${base}&t=${startSeconds}s`;
  }
  return base;
}

function LiveHeroContent({
  vm,
  watchOnYoutubeHref,
}: {
  vm: LiveVm;
  watchOnYoutubeHref?: string | undefined;
}) {
  return <LaxHeroLiveOverlayContent vm={vm} watchOnYoutubeHref={watchOnYoutubeHref} />;
}

/** Twitch / Vimeo / Cloudflare: stacked embed + panel (legacy layout). */
function LaxHeroLiveSplitEmbed({ vm }: Props) {
  return (
    <section className="relative w-full bg-hero-cream dark:bg-surface-container-low">
      <div
        className={cn(
          "relative mx-auto flex w-full max-w-[var(--container-max,1440px)] flex-col",
          HOME_HERO_MIN_H,
        )}
      >
        <div className="relative aspect-video w-full shrink-0 bg-black">
          <RevealOnMount
            className="absolute inset-0 overflow-hidden"
            innerClassName="absolute inset-0"
          >
            <DeferredLiveIframe
              title={`Live auction: ${vm.saleTitle}`}
              src={vm.embedSrc}
              posterUrl={vm.posterImageUrl ?? null}
              posterAlt={`${vm.saleTitle} — live saleroom`}
              withTwitchParent={vm.provider === "twitch"}
              className="absolute inset-0 h-full w-full"
            />
          </RevealOnMount>
        </div>
        <div className="relative flex flex-1 flex-col justify-end border-t border-nav-border bg-hero-cream px-6 py-10 md:px-10 dark:border-border-hairline dark:bg-surface-container-low">
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
                <Link
                  href={vm.saleroomHref}
                  className="inline-flex items-center justify-center gap-2"
                >
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

export function LaxHeroLiveStream({ vm }: Props) {
  const useYoutubeBackground = vm.provider === "youtube" && Boolean(vm.videoId);

  if (!useYoutubeBackground) {
    return <LaxHeroLiveSplitEmbed vm={vm} />;
  }

  const videoId = vm.videoId as string;
  const bgSrc = youtubeHeroBackgroundSrc(videoId, vm.startSeconds);
  const watchHref = watchOnYoutubeUrl(videoId, vm.startSeconds);
  const poster = vm.posterImageUrl;

  return (
    <section className="relative w-full bg-hero-cream dark:bg-surface-container-low">
      <div
        className={cn(
          "relative mx-auto w-full max-w-[var(--container-max,1440px)]",
          HOME_HERO_MIN_H,
        )}
      >
        <HeroAdaptiveShell
          src={poster}
          alt={`${vm.saleTitle} — saleroom cover`}
          priority
          imgClassName="object-center opacity-0 motion-reduce:opacity-100"
          backdropScrim={
            <>
              <div className="pointer-events-none absolute inset-0 z-[1] block motion-reduce:hidden">
                <RevealOnMount
                  className="absolute inset-0 overflow-hidden"
                  innerClassName="absolute inset-0"
                >
                  <iframe
                    title={`Live auction: ${vm.saleTitle}`}
                    src={bgSrc}
                    className="absolute left-1/2 top-1/2 h-[max(100%,56.25vw)] w-[max(100%,177.78vh)] max-w-none -translate-x-1/2 -translate-y-1/2 border-0"
                    loading="eager"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </RevealOnMount>
              </div>
              <HeroHorizontalScrim />
            </>
          }
        >
          <LiveHeroContent vm={vm} watchOnYoutubeHref={watchHref} />
        </HeroAdaptiveShell>
      </div>
    </section>
  );
}
