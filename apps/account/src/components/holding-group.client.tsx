"use client";

import { TableCell, TableRow } from "@auction/ui/components/table";
import { type ReactNode, useId, useState } from "react";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 8 5 5 5-5" />
    </svg>
  );
}

/** "Reed Study · 10 copies": the artwork's name and the button that shows or hides the copies. */
function GroupHeading({
  title,
  copyCount,
  open,
  onToggle,
  controls,
}: {
  title: string;
  copyCount: number;
  open: boolean;
  onToggle: () => void;
  controls?: string;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-1 font-medium break-words">
      <span>{title}</span>
      <span aria-hidden="true">·</span>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={controls}
        onClick={onToggle}
        className="inline-flex min-h-11 items-center gap-1 rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {copyCount} copies
        <span className="sr-only"> of {title}</span>
        <Chevron open={open} />
      </button>
    </p>
  );
}

type GroupProps = {
  title: string;
  copyCount: number;
  /** Open at first, as when a search or filter matched copies inside the group. */
  defaultOpen: boolean;
  thumbnail: ReactNode;
  /** Artist and edition lines under the heading. */
  details: ReactNode;
  /** The copies, shown only while the group is open. */
  copies: ReactNode;
};

/** A group in the desktop table: its summary row, then one row per copy while it is open. */
export function HoldingGroupTableRows({
  title,
  copyCount,
  defaultOpen,
  thumbnail,
  details,
  copies,
  cells,
}: GroupProps & { cells: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-3">
            {thumbnail}
            <div className="min-w-0">
              <GroupHeading
                title={title}
                copyCount={copyCount}
                open={open}
                onToggle={() => setOpen(!open)}
              />
              {details}
            </div>
          </div>
        </TableCell>
        {cells}
      </TableRow>
      {open ? copies : null}
    </>
  );
}

/** A group on a phone: its card, with the copies listed inside it while it is open. */
export function HoldingGroupCard({
  title,
  copyCount,
  defaultOpen,
  thumbnail,
  details,
  copies,
  summary,
}: GroupProps & { summary: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const copiesId = useId();
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border-hairline bg-surface p-4">
      <div className="flex gap-3">
        {thumbnail}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <GroupHeading
              title={title}
              copyCount={copyCount}
              open={open}
              onToggle={() => setOpen(!open)}
              controls={copiesId}
            />
            {details}
          </div>
          {summary}
        </div>
      </div>
      <div id={copiesId} hidden={!open}>
        {open ? copies : null}
      </div>
    </li>
  );
}
