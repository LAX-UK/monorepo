import { Download, FileText, ImageIcon } from "lucide-react";
import { cn } from "../lib/utils.js";

export type FileAttachmentProps = {
  /** The file's name as it reads on the card. */
  name: string;
  /** Where the file opens; the download control saves the same file. */
  href: string;
  /** Draws the tile: a photo shows its thumbnail when one is given, a PDF its icon. */
  kind: "image" | "pdf";
  /** "1.8 MB": shown after the type. */
  size?: string | null;
  /** A small preview of a photo; the icon is drawn without one. */
  thumbnailUrl?: string | null;
  className?: string;
};

const TYPE_WORD = { image: "Photo", pdf: "PDF" } as const;

/**
 * A file sent with a message or kept on a record: a 40px tile (the photo's thumbnail, or a file
 * icon), the name opening the file in a new tab, its type and size, and a download control. One
 * card per file, as wide as its content up to the space it sits in.
 */
export function FileAttachment({
  name,
  href,
  kind,
  size,
  thumbnailUrl,
  className,
}: FileAttachmentProps) {
  const Icon = kind === "pdf" ? FileText : ImageIcon;
  const meta = [TYPE_WORD[kind], size].filter(Boolean).join(" · ");
  return (
    <div
      className={cn(
        "flex w-fit max-w-full items-center gap-3 rounded-lax-card border border-lax-line bg-lax-surface py-2 pr-2 pl-2",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lax-control bg-lax-sunken text-lax-muted"
      >
        {kind === "image" && thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <Icon className="size-4" strokeWidth={1.75} />
        )}
      </span>
      <span className="min-w-0">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate rounded-lax-badge text-lax-13 leading-5 font-medium text-lax-fg underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lax-focus"
        >
          {name}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <span className="block text-lax-12 leading-4 text-lax-muted">{meta}</span>
      </span>
      <a
        href={href}
        download={name}
        aria-label={`Download ${name}`}
        className="grid size-8 shrink-0 place-items-center rounded-lax-control text-lax-muted hover:bg-lax-hover hover:text-lax-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lax-focus active:bg-lax-pressed"
      >
        <Download aria-hidden className="size-4" strokeWidth={1.75} />
      </a>
    </div>
  );
}
