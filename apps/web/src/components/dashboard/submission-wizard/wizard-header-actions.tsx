"use client";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import {
  SUBMISSION_FINISH_LATER_LABEL,
  SUBMISSION_LEAVE_WITHOUT_SAVING_HINT,
  SUBMISSION_LEAVE_WITHOUT_SAVING_LABEL,
} from "@/lib/marketing/sell-flow-copy";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import { MoreVertical } from "lucide-react";
import { useState } from "react";

type Props = {
  isSubmitting: boolean;
  onFinishLater: () => void;
  onLeaveWithoutSaving: () => void;
  onWithdraw?: () => void;
};

export function WizardHeaderActions({
  isSubmitting,
  onFinishLater,
  onLeaveWithoutSaving,
  onWithdraw,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const leaveWithoutSaving = () => {
    setMenuOpen(false);
    onLeaveWithoutSaving();
  };

  const withdraw = () => {
    setMenuOpen(false);
    onWithdraw?.();
  };

  return (
    <>
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {onWithdraw ? (
          <ConfirmActionButton
            type="button"
            variant="secondaryOutline"
            size="sm"
            className="font-label text-xs uppercase tracking-wider"
            disabled={isSubmitting}
            confirmTitle="Withdraw submission"
            confirmBody="Withdraw this submission? You can start a new submission later if needed."
            confirmLabel="Withdraw"
            onConfirmed={withdraw}
            data-testid="wizard-withdraw"
          >
            Withdraw
          </ConfirmActionButton>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-label text-xs uppercase tracking-wider"
          disabled={isSubmitting}
          onClick={onFinishLater}
          data-testid="wizard-finish-later"
        >
          {SUBMISSION_FINISH_LATER_LABEL}
        </Button>
      </div>

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen}>
        <BottomSheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 sm:hidden"
            aria-label="More actions"
            data-testid="wizard-actions-menu"
          >
            <MoreVertical className="size-5" aria-hidden />
          </Button>
        </BottomSheetTrigger>
        <BottomSheetContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <BottomSheetHeader>
            <BottomSheetTitle className="font-headline text-left text-lg">
              More actions
            </BottomSheetTitle>
          </BottomSheetHeader>
          <ul className="mt-4 flex flex-col gap-1 px-6 pb-6">
            <li>
              <Button
                type="button"
                variant="ghost"
                className="h-12 w-full justify-start font-body text-base"
                disabled={isSubmitting}
                onClick={() => {
                  setMenuOpen(false);
                  onFinishLater();
                }}
                data-testid="wizard-finish-later-mobile"
              >
                {SUBMISSION_FINISH_LATER_LABEL}
              </Button>
            </li>
            {onWithdraw ? (
              <li>
                <ConfirmActionButton
                  type="button"
                  variant="ghost"
                  className="h-12 w-full justify-start font-body text-base text-on-surface-variant"
                  disabled={isSubmitting}
                  confirmTitle="Withdraw submission"
                  confirmBody="Withdraw this submission? You can start a new submission later if needed."
                  confirmLabel="Withdraw"
                  onConfirmed={withdraw}
                  data-testid="wizard-withdraw-mobile"
                >
                  Withdraw
                </ConfirmActionButton>
              </li>
            ) : null}
            <li>
              <Button
                type="button"
                variant="ghost"
                className="h-12 w-full justify-start font-body text-base text-on-surface-variant"
                disabled={isSubmitting}
                onClick={leaveWithoutSaving}
                data-testid="wizard-leave-without-saving"
              >
                {SUBMISSION_LEAVE_WITHOUT_SAVING_LABEL}
              </Button>
              <p className="px-3 pb-2 font-body text-xs text-on-surface-variant">
                {SUBMISSION_LEAVE_WITHOUT_SAVING_HINT}
              </p>
            </li>
          </ul>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}
