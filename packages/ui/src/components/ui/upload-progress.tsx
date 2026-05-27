"use client";

import { cn } from "../../lib/utils.js";
import { Progress } from "./progress.js";

export type UploadProgressProps = {
  value: number;
  label?: string;
  className?: string;
};

function UploadProgress({ value, label, className }: UploadProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("grid gap-1", className)}>
      {label ? <p className="text-xs text-on-surface-variant">{label}</p> : null}
      <Progress value={clamped} aria-label={label ?? "Upload progress"} />
      <p className="text-right font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
        {Math.round(clamped)}%
      </p>
    </div>
  );
}

export { UploadProgress };
