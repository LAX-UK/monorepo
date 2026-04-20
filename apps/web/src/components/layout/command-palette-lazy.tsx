"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const CommandPaletteDynamic = dynamic(
  () =>
    import("@/components/layout/command-palette").then((mod) => ({ default: mod.CommandPalette })),
  { ssr: false },
);

export function CommandPaletteLazy(props: ComponentProps<typeof CommandPaletteDynamic>) {
  return <CommandPaletteDynamic {...props} />;
}
