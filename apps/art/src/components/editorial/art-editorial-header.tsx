import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ReactNode } from "react";

type ArtEditorialHeaderProps = {
  kicker?: string | null;
  title: string;
  standfirst?: string | null;
  coverUrl?: string | null;
  children?: ReactNode;
};

/** Kicker, display title, standfirst and an optional wide cover for editorial detail pages. */
export function ArtEditorialHeader({
  kicker,
  title,
  standfirst,
  coverUrl,
  children,
}: ArtEditorialHeaderProps) {
  return (
    <header className="flex flex-col gap-6">
      <div className="flex max-w-3xl flex-col gap-3">
        {kicker ? (
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking)] text-on-surface-variant">
            {kicker}
          </p>
        ) : null}
        <h1 className="font-headline text-[length:var(--text-display-md,2.5rem)] font-semibold leading-tight tracking-tight text-on-surface">
          {title}
        </h1>
        {standfirst ? <p className="text-lg text-on-surface-variant">{standfirst}</p> : null}
        {children}
      </div>
      {coverUrl ? (
        <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-surface-container lg:aspect-[21/9]">
          <ArtMediaImage
            src={coverUrl}
            alt=""
            priority
            sizes="(min-width: 90rem) 88rem, 100vw"
            className="absolute inset-0 size-full"
            imgClassName="object-cover"
          />
        </div>
      ) : null}
    </header>
  );
}
