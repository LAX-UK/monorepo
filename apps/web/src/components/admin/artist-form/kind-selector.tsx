"use client";

import { ARTIST_KIND_OPTIONS, artistKindMeta } from "@/lib/artists/kind-presenter";
import type { ArtistKind } from "@auction/types";
import { Brush, Factory, Gem, Tag } from "lucide-react";

const KIND_ICONS: Record<ArtistKind, typeof Brush> = {
  artist: Brush,
  maker: Factory,
  brand: Gem,
  marque: Tag,
};

type Props = {
  value: ArtistKind;
  onChange: (kind: ArtistKind) => void;
  onBlur: () => void;
  disabled?: boolean;
  "aria-labelledby"?: string;
};

/** Large selectable cards; kind copy comes from {@link artistKindMeta} (OCP). */
export function KindSelector({
  value,
  onChange,
  onBlur,
  disabled = false,
  "aria-labelledby": ariaLabelledBy,
}: Props) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2"
      role="radiogroup"
      aria-label="Artist kind"
      aria-labelledby={ariaLabelledBy}
    >
      {ARTIST_KIND_OPTIONS.map((opt) => {
        const active = value === opt.value;
        const meta = artistKindMeta(opt.value);
        const Icon = KIND_ICONS[opt.value];
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            // biome-ignore lint/a11y/useSemanticElements: card grid; native radios break layout
            role="radio"
            aria-checked={active}
            onBlur={onBlur}
            onClick={() => onChange(opt.value)}
            className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
              active
                ? "border-primary bg-primary-container/25 ring-1 ring-primary/30"
                : "border-outline-variant/40 bg-surface-container-lowest hover:border-primary/35"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-surface-container-high text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="font-label text-[11px] uppercase tracking-wide text-on-surface">
              {meta.label}
            </span>
            <span className="text-xs leading-snug text-on-surface-variant">{meta.description}</span>
          </button>
        );
      })}
    </div>
  );
}
