import { LiveDot } from "@auction/ui";

type LiveIndicatorRowProps = {
  tone: "dark" | "light" | "white";
  progressLabel: string;
  saleLine: string;
  /** When true, status text is exposed to assistive tech as a polite live region. */
  announceUpdates?: boolean;
};

export function LiveIndicatorRow({
  tone,
  progressLabel,
  saleLine,
  announceUpdates = false,
}: LiveIndicatorRowProps) {
  const textMuted =
    tone === "dark"
      ? "text-brand-200"
      : tone === "light"
        ? "text-brand-400"
        : "text-white/90";
  const dividerBg =
    tone === "dark" ? "bg-black/78" : tone === "light" ? "bg-brand-400/78" : "bg-white/45";

  return (
    <div
      className="flex flex-row flex-wrap items-center gap-1 md:gap-0.5"
      {...(announceUpdates ? { role: "status", "aria-live": "polite" as const } : {})}
    >
      <LiveDot className="h-5 w-5" />
      <span
        className={`font-label text-xs font-semibold uppercase leading-[18px] tracking-[1.8px] ${textMuted}`}
      >
        {progressLabel}
      </span>
      <span className={`mx-1 hidden h-px w-2.5 shrink-0 sm:block ${dividerBg}`} aria-hidden />
      <span
        className={`font-label text-[10px] font-semibold uppercase leading-3 tracking-[1.8px] ${textMuted}`}
      >
        {saleLine}
      </span>
    </div>
  );
}
