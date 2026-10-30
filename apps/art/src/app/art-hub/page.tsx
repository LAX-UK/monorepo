import { ArtHubFilm } from "@/components/art-hub/art-hub-film";
import { ArtHubNowOn } from "@/components/art-hub/art-hub-now-on";
import { ArtHubSpotlight } from "@/components/art-hub/art-hub-spotlight";
import { ArtHubStories } from "@/components/art-hub/art-hub-stories";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { ArtHubPressBand } from "@/components/editorial/art-hub-press-band";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { ArtProductDoors } from "@/components/product-doors/art-product-doors";
import { artServices } from "@/lib/art-services.server";
import {
  type ArtHubPageVm,
  type ArtHubSectionId,
  composeArtHubPage,
} from "@/lib/editorial/art-hub-page.composer";
import { ART_HUB_COLLECTING, ART_HUB_HERO } from "@/lib/editorial/art-hub.vm";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import {
  MarketingAudioPlayer,
  MarketingLinkList,
  MarketingReveal,
  MarketingSplitFeature,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Art Hub | lax.art",
  description:
    "Stories, conversations and films from the artists, exhibitions and people behind the London Art Exchange.",
  alternates: { canonical: "/art-hub" },
};

function Shell({ children }: { children: ReactNode }) {
  return <div className={MARKETING_PAGE_SHELL}>{children}</div>;
}

function panelImage(src: string, label: string, priority = false) {
  return (
    <ArtMediaImage
      src={src}
      alt=""
      label={label}
      priority={priority}
      sizes="(min-width: 48rem) 50vw, 100vw"
      className="absolute inset-0 size-full"
      imgClassName="object-cover"
    />
  );
}

/** A cream panel that gave way to the page surface (a band sits next to it) renders plain. */
function panelTone(vm: ArtHubPageVm, id: ArtHubSectionId): "feature" | "plain" {
  return vm.surfaces[id] === "band" ? "feature" : "plain";
}

function HubSection({ id, vm }: { id: ArtHubSectionId; vm: ArtHubPageVm }) {
  switch (id) {
    case "hero":
      return (
        <MarketingSplitFeature
          tone="plain"
          headingLevel="h1"
          mediaSide="right"
          eyebrow={ART_HUB_HERO.eyebrow}
          title={ART_HUB_HERO.title}
          body={
            <div className="flex flex-col gap-8">
              <p>{ART_HUB_HERO.body}</p>
              <MarketingLinkList
                ariaLabel={ART_HUB_HERO.linksLabel}
                items={vm.hero.links}
                className="max-w-sm"
              />
            </div>
          }
          {...(vm.hero.imageUrl ? { media: panelImage(vm.hero.imageUrl, "Art Hub", true) } : {})}
        />
      );
    case "now-on":
      return <ArtHubNowOn cards={vm.nowOn} />;
    case "stories":
      return (
        <Shell>
          <ArtHubStories cards={vm.stories} />
        </Shell>
      );
    case "spotlight":
      return (
        <Shell>
          <ArtHubSpotlight artists={vm.spotlight} />
        </Shell>
      );
    case "podcast": {
      const { podcast } = vm;
      if (!podcast) return null;
      return (
        <MarketingSplitFeature
          tone={panelTone(vm, id)}
          mediaSide="left"
          eyebrow="Podcast"
          title={podcast.title}
          body={
            <div className="flex flex-col gap-6">
              {podcast.description ? <p>{podcast.description}</p> : null}
              <MarketingAudioPlayer
                src={podcast.audioUrl}
                title={podcast.title}
                durationSeconds={podcast.durationSeconds}
              />
            </div>
          }
          action={
            <Button asChild variant="secondaryOutline" size="lg">
              <Link href={podcast.href}>Explore the episode</Link>
            </Button>
          }
          {...(podcast.imageUrl ? { media: panelImage(podcast.imageUrl, "Podcast") } : {})}
        />
      );
    }
    case "films":
      return vm.film ? (
        <Shell>
          <ArtHubFilm film={vm.film} />
        </Shell>
      ) : null;
    case "collecting":
      return (
        <MarketingSplitFeature
          tone={panelTone(vm, id)}
          mediaSide="right"
          title={ART_HUB_COLLECTING.title}
          body={<p>{ART_HUB_COLLECTING.body}</p>}
          action={
            <Button asChild size="lg" className="min-h-11 font-label">
              <Link href={ART_HUB_COLLECTING.cta.href}>{ART_HUB_COLLECTING.cta.label}</Link>
            </Button>
          }
          {...(vm.collectingImageUrl
            ? { media: panelImage(vm.collectingImageUrl, "Collecting") }
            : {})}
        />
      );
    case "press":
      return <ArtHubPressBand rows={vm.press} />;
    case "product-doors":
      return <ArtProductDoors doors={vm.productDoors} />;
  }
}

export default async function ArtHubPage() {
  const result = await composeArtHubPage(artServices);
  if (result.status !== "ok") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtEditorialStatus
          result={result}
          disabledTitle="Art Hub coming soon"
          disabledDescription="Editorial programming is not enabled in this environment yet."
          emptyTitle="Art Hub is empty"
          emptyDescription="Stories, films and episodes will appear here when published."
        />
      </div>
    );
  }

  const vm = result.data;
  const lastIsBand = vm.surfaces[vm.sections.at(-1) ?? "hero"] === "band";
  return (
    <div
      className={cn(
        "flex flex-col gap-[var(--section-spacing)]",
        // A closing band meets the footer directly; a plain section keeps one section gap.
        !lastIsBand && "pb-[var(--section-spacing)]",
      )}
    >
      {vm.sections.map((id, index) => (
        <MarketingReveal key={id} index={index}>
          <HubSection id={id} vm={vm} />
        </MarketingReveal>
      ))}
    </div>
  );
}
