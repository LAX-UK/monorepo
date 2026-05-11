"use client";

import { Button } from "@auction/ui/components/button";
import { useState } from "react";

export function CopyUuidButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        window.setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? "Copied" : "Copy UUID"}
    </Button>
  );
}
