import { cn } from "../../lib/utils.js";

type LiveDotProps = {
  className?: string;
  /** Outer pulse ring size */
  size?: "sm" | "md";
};

const outer = {
  sm: "h-[14px] w-[14px]",
  md: "h-[19.51px] w-[19.51px]",
} as const;

const inner = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
} as const;

export function LiveDot({ className = "", size = "md" }: LiveDotProps) {
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      aria-hidden
    >
      <span
        className={cn("absolute inline-flex rounded-full bg-live-red opacity-[0.05]", outer[size])}
        aria-hidden
      />
      <span
        className={cn("relative inline-flex rounded-full bg-live-red opacity-[0.78]", inner[size])}
        aria-hidden
      />
    </span>
  );
}
