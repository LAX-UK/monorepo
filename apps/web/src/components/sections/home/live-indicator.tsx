type LiveIndicatorRowProps = {
  tone: "dark" | "light";
  progressLabel: string;
  saleLine: string;
};

export function LiveIndicatorRow({ tone, progressLabel, saleLine }: LiveIndicatorRowProps) {
  const textMuted = tone === "dark" ? "text-brand-200" : "text-brand-400";
  const dividerBg = tone === "dark" ? "bg-black/78" : "bg-brand-400/78";

  return (
    <div className="flex flex-row flex-wrap items-center gap-1 md:gap-0.5">
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <span
          className="absolute inline-flex h-[19.51px] w-[19.51px] rounded-full bg-live-red opacity-[0.05]"
          aria-hidden
        />
        <span
          className="relative inline-flex h-2.5 w-2.5 rounded-full bg-live-red opacity-[0.78]"
          aria-hidden
        />
      </span>
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
