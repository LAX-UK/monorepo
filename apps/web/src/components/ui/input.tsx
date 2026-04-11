import type { InputHTMLAttributes } from "react";

export function UnderlineInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full border-0 border-b-2 border-outline/40 bg-transparent py-3 font-headline text-2xl text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:border-primary focus:shadow-[0_0_0_1px_rgba(199,160,89,0.25)] ${className}`}
      {...props}
    />
  );
}
