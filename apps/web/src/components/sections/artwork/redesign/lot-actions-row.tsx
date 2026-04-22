import type { ReactNode } from "react";

type Props = {
  followSlot: ReactNode;
  shareSlot: ReactNode;
};

/**
 * Figma: two equal outline buttons (Follow, Share). Children bring their own button/link styles.
 */
export function LotActionsRow({ followSlot, shareSlot }: Props) {
  return (
    <div className="flex w-full max-w-[550px] flex-row items-stretch gap-4 md:gap-10">
      <div className="min-w-0 flex-1 [&_a]:w-full [&_button]:w-full">{followSlot}</div>
      <div className="min-w-0 flex-1 [&_a]:w-full [&_button]:w-full">{shareSlot}</div>
    </div>
  );
}
