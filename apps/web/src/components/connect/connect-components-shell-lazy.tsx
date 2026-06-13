"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const ConnectComponentsShellDynamic = dynamic(
  () =>
    import("@/components/connect/connect-components-shell").then((mod) => ({
      default: mod.ConnectComponentsShell,
    })),
  { ssr: false },
);

export function ConnectComponentsShellLazy(
  props: ComponentProps<typeof ConnectComponentsShellDynamic>,
) {
  return <ConnectComponentsShellDynamic {...props} />;
}
