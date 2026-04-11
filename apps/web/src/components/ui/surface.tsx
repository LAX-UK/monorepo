import type { HTMLAttributes, ReactNode } from "react";

const levels = {
  base: "bg-surface",
  lowest: "bg-surface-container-lowest",
  low: "bg-surface-container-low",
  mid: "bg-surface-container",
  high: "bg-surface-container-high",
  highest: "bg-surface-container-highest",
  dim: "bg-surface-dim",
  bright: "bg-surface-bright",
} as const;

export type SurfaceLevel = keyof typeof levels;

export function Surface({
  level = "base",
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  level?: SurfaceLevel;
  children: ReactNode;
}) {
  return (
    <div className={`${levels[level]} ${className}`} {...props}>
      {children}
    </div>
  );
}
