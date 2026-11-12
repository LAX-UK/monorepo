import type { DeviceKind } from "@auction/identity-contracts/account";
import type { ReactNode } from "react";

const SHAPES: Record<DeviceKind, ReactNode> = {
  laptop: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M2 19h20" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </>
  ),
  tablet: (
    <>
      <rect x="4.5" y="2.5" width="15" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </>
  ),
};

/**
 * A laptop, phone or tablet in a small neutral tile. Decorative: the row names the device in
 * words. Neutral on purpose, because no product owns a device.
 */
export function DeviceKindIcon({ kind }: { kind: DeviceKind }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border-hairline bg-surface text-on-surface">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        className="size-4"
      >
        {SHAPES[kind]}
      </svg>
    </span>
  );
}
