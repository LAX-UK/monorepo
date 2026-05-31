"use client";

import { ARTIST_KIND_OPTIONS, artistKindMeta } from "@/lib/artists/kind-presenter";
import type { ArtistKind } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  BookOpen,
  Brush,
  Building2,
  Car,
  Coins,
  Factory,
  Gem,
  Landmark,
  PenTool,
  Tag,
  Wine,
} from "lucide-react";

/** Icons per kind with a safe fallback so new kinds never break the grid. (OCP) */
const KIND_ICONS: Partial<Record<ArtistKind, typeof Brush>> = {
  artist: Brush,
  maker: Factory,
  designer: PenTool,
  studio: Building2,
  brand: Gem,
  marque: Tag,
  manufacturer: Factory,
  coachbuilder: Car,
  author: BookOpen,
  publisher: BookOpen,
  printer: BookOpen,
  mint: Coins,
  issuing_authority: Landmark,
  producer: Wine,
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
        const Icon = KIND_ICONS[opt.value] ?? Brush;
        return (
          <Button
            key={opt.value}
            type="button"
            variant="outline"
            disabled={disabled}
            // biome-ignore lint/a11y/useSemanticElements: card grid; native radios break layout
            role="radio"
            aria-checked={active}
            onBlur={onBlur}
            onClick={() => onChange(opt.value)}
            className={`flex h-auto min-h-0 w-full min-w-0 flex-col items-start gap-2 whitespace-normal rounded-xl border p-3 text-left shadow-none transition-colors ${
              active
                ? "border-primary bg-primary-container/25 ring-1 ring-primary/30"
                : "border-outline-variant/40 bg-surface-container-lowest hover:border-primary/35"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="w-full break-words font-label text-[11px] uppercase tracking-wide text-on-surface">
              {meta.label}
            </span>
            <span className="w-full break-words text-xs leading-snug text-on-surface-variant">
              {meta.description}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
