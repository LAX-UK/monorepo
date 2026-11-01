"use client";

import { cn } from "@auction/ui";
import { Button, textLinkClass } from "@auction/ui/lax";
import { X } from "lucide-react";
import { ON_IMAGE_BUTTON, ON_IMAGE_FOCUS } from "./cover-on-image.js";
import type { CoverFilm, CoverTone } from "./cover-types.js";

/** The "Play film" action: an ink link that is a button, because it starts something. */
export function CoverFilmButton({
  tone,
  onPlay,
}: {
  /** The tone of the picture the button sits on; null on the page's own surface. */
  tone: CoverTone | null;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className={cn(
        textLinkClass,
        "max-md:min-h-11 max-md:justify-center",
        tone && ["md:text-[color:var(--cover-link)]", ON_IMAGE_FOCUS[tone]],
      )}
    >
      Play film
    </button>
  );
}

/**
 * The film, over the cover's picture. It exists only after "Play film" is pressed, so a visit
 * costs no video data and shows no motion. The embed address starts it muted with captions on.
 */
export function CoverFilmPlayer({
  film,
  tone,
  onClose,
}: {
  film: CoverFilm;
  tone: CoverTone | null;
  onClose: () => void;
}) {
  return (
    <div
      data-cover-film=""
      className="absolute inset-x-0 top-0 z-20 h-[340px] bg-black md:inset-0 md:h-auto"
    >
      <iframe
        title={film.title}
        src={film.src}
        className="absolute inset-0 h-full w-full border-0"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label="Close film"
        className={cn(
          "absolute right-4 top-4",
          tone && [ON_IMAGE_BUTTON[tone], ON_IMAGE_FOCUS[tone]],
        )}
        onClick={onClose}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
