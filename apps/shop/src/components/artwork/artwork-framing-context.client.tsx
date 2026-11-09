"use client";

import type { ArtworkFramingVm } from "@/lib/artwork/artwork-framing.vm";
import type { PublicFramingOption } from "@auction/shop-contracts";
import { type ReactNode, createContext, useContext, useMemo, useState } from "react";

type ChooseVm = Extract<ArtworkFramingVm, { kind: "choose" }>;

/**
 * The shopper's framing choice, shared by the picture, the price and the buy button so they
 * always agree: an option id, null for unframed, or undefined while a frame must still be chosen
 * (an edition sold framed only).
 */
type FramingChoice = {
  vm: ChooseVm;
  selectedId: string | null | undefined;
  select: (id: string | null) => void;
};

const FramingChoiceContext = createContext<FramingChoice | null>(null);

export function ArtworkFramingProvider({
  vm,
  children,
}: {
  vm: ChooseVm;
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null | undefined>(vm.defaultId);
  const value = useMemo<FramingChoice>(
    () => ({ vm, selectedId, select: setSelectedId }),
    [vm, selectedId],
  );
  return <FramingChoiceContext.Provider value={value}>{children}</FramingChoiceContext.Provider>;
}

/** The framing choice, or null on an edition with no choice to make. */
export function useFramingChoice(): FramingChoice | null {
  return useContext(FramingChoiceContext);
}

/** The frame finish to draw round the picture, while a framed option is selected. */
export function useFramedPreview(): PublicFramingOption["frame"] | null {
  const choice = useFramingChoice();
  if (!choice || choice.selectedId === null || choice.selectedId === undefined) return null;
  return choice.vm.choices.find((entry) => entry.id === choice.selectedId)?.frame ?? null;
}
