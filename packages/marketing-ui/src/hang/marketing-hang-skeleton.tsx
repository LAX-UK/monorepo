import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";

type MarketingHangSkeletonProps = {
  /** How many works to suggest; the real hang may show a different number. */
  count?: number;
  className?: string;
};

const BLOCK = "bg-surface-container-low motion-safe:animate-pulse";
/** Heights that suggest works of different sizes on one centre line. */
const WORK_HEIGHT_SHARE = [1, 0.62, 0.8, 0.5, 0.9] as const;

/**
 * The hang while its data loads. It reserves the same heights as the real wall (a 300px slot on
 * desktop, 180px on a phone, plus the label lines and the key), so nothing moves when the works
 * arrive.
 */
export function MarketingHangSkeleton({ count = 4, className }: MarketingHangSkeletonProps) {
  return (
    <section
      aria-hidden
      data-testid="marketing-hang-skeleton"
      className={cn("pt-10 sm:pt-14", className)}
    >
      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-1")}>
        <div className={cn(BLOCK, "h-7 w-40 rounded-sm sm:h-9 sm:w-56")} />
        <div className={cn(BLOCK, "h-5 w-52 rounded-sm sm:w-72")} />
      </div>
      <div className="mt-4 bg-[var(--color-surface-paper,#f6f4ee)] pt-6 pb-4 sm:mt-6 sm:pt-12 sm:pb-7">
        <div
          className={cn(
            MARKETING_PAGE_SHELL,
            "flex items-start gap-7 overflow-hidden sm:justify-center sm:gap-14",
          )}
        >
          {Array.from({ length: count }, (_, i) => {
            const share = WORK_HEIGHT_SHARE[i % WORK_HEIGHT_SHARE.length] ?? 1;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
              <div key={i} className="w-[140px] flex-none sm:w-[168px]">
                <div className="flex h-[180px] items-center sm:h-[300px]">
                  <div
                    className={cn(BLOCK, "w-full bg-surface-container")}
                    style={{ height: `${Math.round(share * 100)}%` }}
                  />
                </div>
                <div className="mt-3 grid gap-px sm:mt-[18px]">
                  <div className={cn(BLOCK, "h-4 w-10 rounded-sm")} />
                  <div className={cn(BLOCK, "h-5 w-3/4 rounded-sm")} />
                  <div className={cn(BLOCK, "h-5 w-1/2 rounded-sm")} />
                  <div className={cn(BLOCK, "h-4 w-2/3 rounded-sm")} />
                </div>
              </div>
            );
          })}
        </div>
        <div className={cn(MARKETING_PAGE_SHELL, "mt-[18px] sm:mt-7")}>
          <div className={cn(BLOCK, "h-4 w-48 rounded-sm")} />
        </div>
      </div>
    </section>
  );
}
