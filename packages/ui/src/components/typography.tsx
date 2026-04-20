import type { HTMLAttributes, ReactNode } from "react";

export function DisplayHeading({
  children,
  className = "",
  as: Tag = "h1",
  ...props
}: HTMLAttributes<HTMLHeadingElement> & {
  children: ReactNode;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <Tag
      className={`font-headline font-light tracking-tight text-on-surface ${className}`}
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
      className={`font-label text-xs font-semibold uppercase tracking-[0.3em] text-secondary ${className}`}
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
