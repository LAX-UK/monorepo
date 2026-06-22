"use client";

import { DeferredLiveIframe } from "@/components/marketing/deferred-live-iframe";
import type { StreamPresentation } from "@/lib/sale-stream-policy";
import type { StreamEmbedProvider } from "@auction/validators";
import { parseStreamEmbedUrl } from "@auction/validators";
import { ExternalLink } from "lucide-react";
import { useMemo } from "react";

type Props = {
  streamUrl: string;
  saleTitle: string;
  posterUrl?: string | null;
  /**
   * When provided, drives the iframe title, CTA button label, and external
   * link label. Defaults to live-stream copy when omitted.
   */
  presentation?: StreamPresentation | null;
  className?: string;
};

const PROVIDER_LABEL: Record<StreamEmbedProvider, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  twitch: "Twitch",
  cloudflare: "stream",
};

/** Click-to-load stream preview with external link fallback.
 * Works for both live streams and archived recordings via the `presentation` prop.
 */
export function SaleStreamPreview({
  streamUrl,
  saleTitle,
  posterUrl,
  presentation,
  className,
}: Props) {
  const embed = useMemo(() => parseStreamEmbedUrl(streamUrl), [streamUrl]);

  const iframeTitle = presentation?.embedTitle ?? `Live stream: ${saleTitle}`;
  const ctaLabel = presentation?.embedCtaLabel ?? "Watch live";
  const externalLinkLabel = presentation?.externalLinkLabel ?? "Open live stream";
  const posterAlt = `${saleTitle} — ${presentation?.phase === "recording" ? "saleroom recording" : "live stream"} preview`;

  if (!embed) {
    return (
      <p className={className}>
        <a
          href={streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-semibold text-on-surface underline underline-offset-2 hover:opacity-80"
        >
          <ExternalLink className="size-4 shrink-0" aria-hidden />
          {externalLinkLabel}
        </a>
      </p>
    );
  }

  const providerLabel = PROVIDER_LABEL[embed.provider];

  return (
    <div className={className}>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-outline-variant/30 bg-black">
        <DeferredLiveIframe
          title={iframeTitle}
          src={embed.src}
          {...(posterUrl !== undefined ? { posterUrl } : {})}
          posterAlt={posterAlt}
          ctaLabel={ctaLabel}
          withTwitchParent={embed.provider === "twitch"}
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
      <p className="mt-3 text-sm">
        <a
          href={streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-on-surface-variant underline underline-offset-2 hover:text-on-surface"
        >
          <ExternalLink className="size-4 shrink-0" aria-hidden />
          Open in {providerLabel}
        </a>
      </p>
    </div>
  );
}
