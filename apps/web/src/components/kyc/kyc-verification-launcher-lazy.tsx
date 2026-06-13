"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const KycVerificationLauncherDynamic = dynamic(
  () =>
    import("@/components/kyc/kyc-verification-launcher").then((mod) => ({
      default: mod.KycVerificationLauncher,
    })),
  { ssr: false },
);

export function KycVerificationLauncherLazy(
  props: ComponentProps<typeof KycVerificationLauncherDynamic>,
) {
  return <KycVerificationLauncherDynamic {...props} />;
}
