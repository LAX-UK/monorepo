"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import { Button } from "@auction/ui/components/button";
import { useCallback, useState } from "react";

type Props = {
  url: string;
  title: string;
  className?: string;
};

export function ShareButton({ url, title, className }: Props) {
  const [done, setDone] = useState(false);

  const share = useCallback(async () => {
    setDone(false);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setDone(true);
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
    } catch {
      setDone(false);
    }
  }, [title, url]);

  return (
    <Button type="button" variant="outline" className={className} onClick={() => void share()}>
      <MaterialIcon name="share" className="text-base" aria-hidden />
      {done ? "Copied" : "Share"}
    </Button>
  );
}
