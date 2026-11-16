import { FileText, ImageIcon } from "lucide-react";
import { cn } from "../lib/cn.js";

/** A file known only by what was said about it: its name, type and size. Nothing to open. */
export type FileMetadataItem = {
  id: string;
  name: string;
  /** "JPEG image · 2.1 MB". */
  detail: string;
  kind: "image" | "document";
};

export type FileMetadataListProps = {
  files: readonly FileMetadataItem[];
  /** The list's accessible name: "Files named in this email". */
  label: string;
  /** Says why there is nothing to open: "The files themselves were not kept." */
  note?: React.ReactNode | undefined;
  className?: string | undefined;
};

/**
 * The files a message said it carried, when only their metadata was kept: a quiet row per file
 * with an icon, the name and its type and size, and no link or download. Used where opening a
 * file would mean trusting content nobody has checked, such as an emailed reply.
 */
export function FileMetadataList({ files, label, note, className }: FileMetadataListProps) {
  if (files.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <ul aria-label={label} className="flex flex-col gap-1.5">
        {files.map((file) => {
          const Icon = file.kind === "image" ? ImageIcon : FileText;
          return (
            <li
              key={file.id}
              className="flex w-fit max-w-full items-center gap-2.5 rounded-staff-md border border-dashed border-staff-control-border px-2.5 py-1.5"
            >
              <Icon aria-hidden className="size-4 shrink-0 text-staff-muted" strokeWidth={1.75} />
              <span className="min-w-0">
                <span className="block truncate text-staff-sm leading-5 font-medium text-staff-fg">
                  {file.name}
                </span>
                <span className="block text-staff-xs leading-4 text-staff-muted">
                  {file.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {note ? <p className="text-staff-xs leading-4 text-staff-muted">{note}</p> : null}
    </div>
  );
}
