"use client";

import { Button } from "@auction/ui/components/button";
import { useId, useMemo, useState } from "react";

type Props = {
  bio: string;
  className?: string;
};

export function ArtistBioReadMore({ bio, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const fullId = useId();
  const needsClamp = useMemo(() => bio.trim().length > 280, [bio]);

  if (!needsClamp) {
    return (
      <p
        className={`max-w-xl font-body text-sm leading-loose text-on-surface-variant ${className}`}
      >
        {bio}
      </p>
    );
  }

  return (
    <div className={className}>
      <p
        id={fullId}
        className={`max-w-xl font-body text-sm leading-loose text-on-surface-variant ${
          open ? "" : "line-clamp-5"
        }`}
      >
        {bio}
      </p>
      <Button
        type="button"
        variant="link"
        className="mt-3 h-auto px-0 py-0 font-label text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={fullId}
      >
        {open ? "Show less" : "Read more"}
      </Button>
    </div>
  );
}
