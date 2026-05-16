import { cn } from "@auction/ui";
import type { HTMLAttributes } from "react";

export type KbdHintProps = HTMLAttributes<HTMLElement>;

/** Keyboard shortcut chip for search / command palette affordances. */
export function KbdHint({ className, children, ...rest }: KbdHintProps) {
  return (
    <kbd
      className={cn(
        "rounded border border-brand-300/80 bg-transparent px-1.5 py-0.5 font-mono text-[0.65rem] font-medium text-brand-900 transition-colors duration-300 motion-reduce:transition-none dark:border-outline-variant/50 dark:text-on-surface sm:inline",
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}

/** Muted chip variant used inside command palette body copy. */
export function KbdHintMuted({ className, children, ...rest }: KbdHintProps) {
  return (
    <kbd
      className={cn(
        "rounded border border-outline-variant/30 bg-surface-container-high px-1.5 py-0.5 font-mono text-xs",
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}
