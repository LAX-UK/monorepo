import { DeferredLiveIframe } from "@/components/sections/home/deferred-live-iframe";
import type { HeroStateVM } from "@/components/sections/home/home-view-models";
import { LiveIndicatorRow } from "@/components/sections/home/live-indicator";
import { MediaImage } from "@/components/ui/media-image";
import { RevealOnMount } from "@/components/ui/reveal";
import { DisplayHeading, LabelCaps, LiveDot } from "@auction/ui";
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
  return (
    <div className="relative z-[2] flex min-h-[min(100svh,520px)] flex-col justify-end px-6 pb-16 pt-32 md:min-h-[min(100svh,760px)] md:px-10 md:pb-20 lg:px-10">
      <div className="relative flex max-w-[684px] flex-col gap-8 md:gap-14">
        <div className="flex flex-col gap-6">
          <LiveIndicatorRow
            tone="white"
            progressLabel="Live saleroom"
            saleLine={vm.saleTitle}
            announceUpdates
          />
          <LabelCaps className="text-base font-medium leading-6 tracking-normal text-white">
            {vm.modeLabel}
          </LabelCaps>
          <DisplayHeading
            as="h1"
            className="text-4xl font-medium uppercase leading-[120%] tracking-tight text-white md:text-[60px] md:leading-[72px]"
          >
            Live · {vm.saleTitle}
          </DisplayHeading>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button variant="liveJoin" size="xl" className="min-h-[44px] w-fit" asChild>
            <Link href={vm.saleroomHref} className="inline-flex items-center justify-center gap-2">
              <LiveDot className="h-5 w-5" />
              Open saleroom
            </Link>
          </Button>
          {watchOnYoutubeHref ? (
            <Button variant="secondary" size="xl" className="min-h-[44px] w-fit" asChild>
              <a href={watchOnYoutubeHref} target="_blank" rel="noreferrer noopener">
                Watch on YouTube<span className="sr-only"> (opens in new tab)</span>
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Twitch / Vimeo / Cloudflare: stacked embed + panel (legacy layout). */
function LaxHeroLiveSplitEmbed({ vm }: Props) {
  return (
    <section className="relative w-full bg-hero-cream dark:bg-surface-container-low">
      <div className="relative mx-auto flex min-h-[min(100svh,520px)] w-full max-w-[var(--container-max,1440px)] flex-col md:min-h-[min(100svh,760px)]">
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
      <div className="relative mx-auto min-h-[min(100svh,520px)] w-full max-w-[var(--container-max,1440px)] md:min-h-[min(100svh,760px)]">
        <div className="absolute inset-0 overflow-hidden bg-black">
          <RevealOnMount
            className="absolute inset-0 z-0 hidden overflow-hidden motion-reduce:block"
            innerClassName="absolute inset-0"
          >
            <MediaImage
              src={poster}
              alt={`${vm.saleTitle} — saleroom cover`}
              label="Auction cover"
              tone="dark"
              priority
              imgClassName="object-center"
              sizes="100vw"
            />
          </RevealOnMount>
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
        </div>
        <div
          className="absolute inset-0 z-[1]"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-scrim-hero), var(--color-scrim-hero-mid), transparent)",
          }}
          aria-hidden
        />
        <LiveHeroContent vm={vm} watchOnYoutubeHref={watchHref} />
      </div>
    </section>
  );
}
