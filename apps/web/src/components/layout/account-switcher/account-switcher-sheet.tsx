"use client";

import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@auction/ui/components/bottom-sheet";
import { AccountSwitcherList } from "./account-switcher-list";
import { useAccountSwitch } from "./use-account-switch";

type Props = {
  switcher: NonNullable<AccountChrome["switcher"]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** The account switcher as a bottom sheet, for phones. */
export function AccountSwitcherSheet({ switcher, open, onOpenChange }: Props) {
  const { pendingId, choose } = useAccountSwitch();
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className="border-outline-variant bg-surface-container-lowest">
        <BottomSheetHeader className="sr-only">
          <BottomSheetTitle>Switch account</BottomSheetTitle>
          <BottomSheetDescription>
            Choose whether to use Bid as yourself or as one of your organisations.
          </BottomSheetDescription>
        </BottomSheetHeader>
        <div className="overflow-y-auto px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <AccountSwitcherList
            switcher={switcher}
            pendingId={pendingId}
            density="sheet"
            onChoose={(option) => {
              onOpenChange(false);
              void choose(option);
            }}
            onNavigate={() => onOpenChange(false)}
          />
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
