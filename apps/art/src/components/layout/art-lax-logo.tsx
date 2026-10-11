import Link from "next/link";

export function ArtLaxLogo() {
  return (
    <Link href="/" className="art-logo inline-flex items-baseline gap-2 art-focus-ring">
      <span className="font-display text-lg font-semibold tracking-tight text-on-surface">LAX</span>
      <span className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant">
        Art
      </span>
    </Link>
  );
}
