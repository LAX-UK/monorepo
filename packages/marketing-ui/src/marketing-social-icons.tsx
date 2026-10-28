import { cn } from "@auction/ui";
import type { SVGProps } from "react";

type MarketingSocialIconProps = SVGProps<SVGSVGElement>;

/** Brand social glyphs — Lucide omits trademark logos; keep paths in marketing-ui SSOT. */
export function MarketingYoutubeIcon({ className, ...props }: MarketingSocialIconProps) {
  return (
    <svg
      className={cn("size-6 shrink-0", className)}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      {...props}
      aria-hidden
    >
      <title>YouTube</title>
      <path
        fill="currentColor"
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1 31.7 31.7 0 0 0 .5-5.8 31.7 31.7 0 0 0-.5-5.8ZM9.7 15.5V8.5L15.8 12 9.7 15.5Z"
      />
    </svg>
  );
}

export function MarketingInstagramIcon({ className, ...props }: MarketingSocialIconProps) {
  return (
    <svg
      className={cn("size-6 shrink-0", className)}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      {...props}
      aria-hidden
    >
      <title>Instagram</title>
      <path
        fill="currentColor"
        d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5Zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5ZM17.8 6.3a1 1 0 1 1-1 1 1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

export function MarketingLinkedInIcon({ className, ...props }: MarketingSocialIconProps) {
  return (
    <svg
      className={cn("size-6 shrink-0", className)}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      {...props}
      aria-hidden
    >
      <title>LinkedIn</title>
      <path
        fill="currentColor"
        d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 8.75h4V21H3V8.75Zm7.5 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6v7.5h-4V15c0-1.6 0-3.6-2.2-3.6-2.2 0-2.5 1.7-2.5 3.5V21h-4V8.75Z"
      />
    </svg>
  );
}

export function MarketingTiktokIcon({ className, ...props }: MarketingSocialIconProps) {
  return (
    <svg
      className={cn("size-6 shrink-0", className)}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      {...props}
      aria-hidden
    >
      <title>TikTok</title>
      <path
        fill="currentColor"
        d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z"
      />
    </svg>
  );
}
