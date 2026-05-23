import { cn } from "@auction/ui";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  href: string;
  children?: ReactNode;
  className?: string;
};

/** External http(s) link for catalog admin detail surfaces. */
export function CatalogExternalLink({ href, children, className }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-start gap-1 break-all text-primary hover:underline",
        className,
      )}
    >
      <span className="min-w-0">{children ?? href}</span>
      <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-70" aria-hidden />
    </a>
  );
}
