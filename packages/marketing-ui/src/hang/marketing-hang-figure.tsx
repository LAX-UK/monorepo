/** A quiet 170 cm human figure, hung beside a single work so its size is felt and not only read. */
export function MarketingHangFigure() {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative, hidden from assistive technology
    <svg
      viewBox="0 0 27 100"
      preserveAspectRatio="xMidYMax meet"
      fill="currentColor"
      aria-hidden
      className="size-full text-on-surface-variant opacity-50"
    >
      <circle cx="13.5" cy="6.5" r="5.6" />
      <path d="M8 14h11c2.6 0 4.2 1.8 4.6 4.4l2.2 22c.2 1.6-.9 2.8-2.3 2.8-1.2 0-2.1-.9-2.3-2.1L19.5 24v72.5c0 1.9-1.4 3.5-3.2 3.5-1.7 0-3-1.4-3-3.2V58h-.6v38.8c0 1.8-1.3 3.2-3 3.2-1.8 0-3.2-1.6-3.2-3.5V24L4.8 41.1c-.2 1.2-1.1 2.1-2.3 2.1-1.4 0-2.5-1.2-2.3-2.8l2.2-22C2.8 15.8 5.4 14 8 14Z" />
    </svg>
  );
}
