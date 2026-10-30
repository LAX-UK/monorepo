"use client";

import { ArtGeneralEnquirySheet } from "@/components/enquiry/art-general-enquiry-sheet.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type {
  ArtworkGalleryImageVm,
  ArtworkSpecialistContactVm,
} from "@/lib/artwork/artwork-detail-page.composer";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import {
  MarketingImageIcon,
  MarketingMoreIcon,
  MarketingPhoneIcon,
  MarketingShareButton,
  MarketingShareIcon,
  MarketingSideSheet,
} from "@auction/marketing-ui";
import { Carousel, CarouselContent, CarouselDots, CarouselItem, cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRef, useState } from "react";

export type ArtArtworkMobileGalleryProps = {
  images: ArtworkGalleryImageVm[];
  slug: string;
  title: string;
  shareUrl: string;
  categoryHref: string | null;
  specialistContact: ArtworkSpecialistContactVm;
};

const overlayButtonClass =
  "art-focus-ring size-11 min-h-11 min-w-11 rounded-full bg-surface/90 p-0 text-on-surface shadow-sm backdrop-blur-sm hover:bg-surface";

const optionRowClass =
  "art-focus-ring flex min-h-12 w-full items-center justify-start gap-3 rounded-sm bg-transparent px-0 text-base font-normal text-on-surface shadow-none hover:bg-transparent hover:underline";

/**
 * Below `md`: full-bleed swipe gallery with a floating Share button and a "More options"
 * sheet (Figma 468:7996, 905:21131). Dots run horizontally under the image because the
 * carousel swipes horizontally; Figma's vertical dots would point the wrong way.
 */
export function ArtArtworkMobileGallery({
  images,
  slug,
  title,
  shareUrl,
  categoryHref,
  specialistContact,
}: ArtArtworkMobileGalleryProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [specialistRequests, setSpecialistRequests] = useState(0);
  const optionsTriggerRef = useRef<HTMLButtonElement>(null);

  const optionsButton = (
    <Button
      ref={optionsTriggerRef}
      type="button"
      variant="ghost"
      aria-label="More options"
      aria-haspopup="dialog"
      aria-expanded={optionsOpen}
      onClick={() => setOptionsOpen(true)}
      className={overlayButtonClass}
    >
      <MarketingMoreIcon />
    </Button>
  );
  const shareButton = (
    <MarketingShareButton
      url={shareUrl}
      title={title}
      appearance="text"
      className={cn(overlayButtonClass, "inline-flex items-center justify-center")}
      label={
        <>
          <MarketingShareIcon />
          <span className="sr-only">Share</span>
        </>
      }
    />
  );

  return (
    <div className="relative md:hidden" data-testid="art-artwork-mobile-gallery">
      {images.length > 0 ? (
        <Carousel aria-label={`Images of ${title}`}>
          <CarouselContent className="ml-0">
            {images.map((image, index) => (
              <CarouselItem
                key={image.url}
                className="pl-0"
                aria-label={`${index + 1} of ${images.length}`}
              >
                <div className="marketing-work-mat relative aspect-square">
                  <ArtMediaImage
                    src={image.url}
                    alt={image.alt}
                    aspect={[1, 1]}
                    sizes="100vw"
                    label={ART_MEDIA_LABELS.artwork}
                    priority={index === 0}
                    className="absolute inset-0 size-full"
                    imgClassName="object-contain"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselDots
            className="absolute inset-x-0 bottom-5 justify-center"
            activeClassName="bg-on-surface"
            inactiveClassName="bg-on-surface/30"
          />
        </Carousel>
      ) : null}
      <div
        className={cn(
          "flex justify-end gap-2",
          images.length > 0 ? "absolute top-3 right-4" : "px-4 pt-2",
        )}
      >
        {optionsButton}
        {images.length > 0 ? null : shareButton}
      </div>
      {images.length > 0 ? <div className="absolute right-4 bottom-3">{shareButton}</div> : null}

      <MarketingSideSheet
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
        title="More options"
        returnFocusRef={optionsTriggerRef}
      >
        <ul className="flex flex-col gap-1 pb-2" data-testid="art-artwork-options">
          <li>
            <MarketingShareButton
              url={shareUrl}
              title={title}
              appearance="text"
              className={optionRowClass}
              label={
                <>
                  <MarketingShareIcon />
                  Share
                </>
              }
            />
          </li>
          {categoryHref ? (
            <li>
              <Button asChild variant="ghost" className={optionRowClass}>
                <Link href={categoryHref}>
                  <MarketingImageIcon />
                  More from this category
                </Link>
              </Button>
            </li>
          ) : null}
          {specialistContact.kind === "ready" ? (
            <li>
              <Button
                type="button"
                variant="ghost"
                className={optionRowClass}
                onClick={() => {
                  setOptionsOpen(false);
                  setSpecialistRequests((count) => count + 1);
                }}
              >
                <MarketingPhoneIcon />
                Contact a specialist
              </Button>
            </li>
          ) : null}
        </ul>
      </MarketingSideSheet>

      {specialistContact.kind === "ready" && specialistRequests > 0 ? (
        // The general enquiry sheet ships with its own trigger. Here it opens from the options
        // sheet instead, so it mounts open (a new key per request) and its trigger stays hidden.
        <div hidden>
          <ArtGeneralEnquirySheet
            key={specialistRequests}
            autoOpen
            defaultTopic="art_advisory"
            contextSlug={slug}
            contextLabel={title}
            contact={specialistContact.contact}
            viewerKind={specialistContact.viewerKind}
          />
        </div>
      ) : null}
    </div>
  );
}
