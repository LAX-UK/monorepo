import type { HTMLAttributes, ReactNode } from "react";

const displaySizeClass: Record<"lg" | "md" | "sm" | "section", string> = {
  lg: "text-[length:var(--text-display-lg)] leading-[1.1]",
  md: "text-[length:var(--text-display-md)] leading-[1.15]",
  sm: "text-[length:var(--text-display-sm)] leading-snug",
  section: "text-[length:var(--text-title-section)] leading-tight",
};

export function DisplayHeading({
  children,
  className = "",
  as: Tag = "h1",
  size,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & {
  children: ReactNode;
  as?: "h1" | "h2" | "h3";
  /** When set, uses `--text-display-*` / `--text-title-section` from `apps/web/src/app/globals.css`. Omit to size via `className` only (legacy). */
  size?: "lg" | "md" | "sm" | "section";
}) {
  return (
    <Tag
      className={`font-headline font-light tracking-tight text-on-surface ${size ? displaySizeClass[size] : ""} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function LabelCaps({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return (
    <span
      className={`font-label text-[length:var(--text-label-1)] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.3em)] text-secondary ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export function BodyText({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p
      className={`font-body text-sm leading-relaxed text-on-surface-variant ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

/** Short uppercase kicker line (e.g. section eyebrow). */
export function Kicker({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p
      className={`font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.3em)] text-primary ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}
